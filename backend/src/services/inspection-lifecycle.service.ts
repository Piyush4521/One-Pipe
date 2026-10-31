/**
 * Inspection Lifecycle Finite State Machine Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2
 *
 * NOTE: Lifecycle transitions strictly model inspection session operations.
 * Robot hardware connection/disconnection does NOT mutate this state.
 */

import { InspectionLifecycleState, InspectionRecord } from '../interfaces/inspection.interface';
import { IInspectionRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';

/**
 * Valid state transition map defining permitted inspection lifecycle paths.
 * Enforces Rulebook § 9 invariant rules.
 */
const ALLOWED_TRANSITIONS: Record<InspectionLifecycleState, readonly InspectionLifecycleState[]> = {
  ready: ['running'],
  running: ['paused', 'completed', 'recovery_required'],
  paused: ['running', 'completed', 'recovery_required'],
  completed: [], // Terminal state. Completed sessions cannot be mutated.
  recovery_required: ['ready', 'completed'],
};

export class InspectionLifecycleService {
  constructor(private readonly repository: IInspectionRepository) {}

  /**
   * Evaluates if a proposed state transition is permissible.
   */
  public isValidTransition(
    current: InspectionLifecycleState,
    target: InspectionLifecycleState
  ): boolean {
    if (current === target) {
      return true; // No-op idempotent transition
    }
    const allowed = ALLOWED_TRANSITIONS[current];
    return allowed ? allowed.includes(target) : false;
  }

  /**
   * Enforces transition rules and updates the inspection state.
   */
  public async transition(
    id: string,
    targetState: InspectionLifecycleState,
    operatorNotes?: string
  ): Promise<InspectionRecord> {
    const inspection = await this.repository.findById(id);

    if (!inspection) {
      const err: AppError = new Error(`Inspection session '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    if (!this.isValidTransition(inspection.status, targetState)) {
      const err: AppError = new Error(
        `Invalid lifecycle transition: Cannot transition inspection from '${inspection.status}' to '${targetState}'.`
      );
      err.statusCode = 409;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    const updates: Partial<InspectionRecord> = {
      status: targetState,
    };

    if (operatorNotes !== undefined) {
      updates.operatorNotes = operatorNotes;
    }

    // Set endTimestamp and calculate duration upon completion
    if (targetState === 'completed' && !inspection.endTimestamp) {
      const now = new Date().toISOString();
      updates.endTimestamp = now;
      const startMs = new Date(inspection.startTimestamp).getTime();
      const endMs = new Date(now).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        updates.durationSeconds = Math.round((endMs - startMs) / 1000);
      }
    }

    const updated = await this.repository.update(id, updates);
    if (!updated) {
      const err: AppError = new Error(`Failed to update inspection session '${id}'.`);
      err.statusCode = 500;
      err.code = 'UPDATE_FAILED';
      throw err;
    }

    return updated;
  }
}
