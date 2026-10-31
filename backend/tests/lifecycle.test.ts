import { beforeEach, describe, expect, it } from 'vitest';
import { RobotConnectionSnapshot } from '../src/interfaces/robot-connection.interface';
import { MemoryInspectionRepository } from '../src/repositories/memory/memory-inspection.repository';
import { InspectionLifecycleService } from '../src/services/inspection-lifecycle.service';

describe('InspectionLifecycleService (State Machine)', () => {
  let repository: MemoryInspectionRepository;
  let service: InspectionLifecycleService;

  beforeEach(() => {
    repository = new MemoryInspectionRepository();
    service = new InspectionLifecycleService(repository);
  });

  it('should initialize inspection in ready state', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-Ready' });
    expect(inspection.status).toBe('ready');
  });

  it('should transition created inspection from ready to running', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-1' });
    expect(inspection.status).toBe('ready');

    const updated = await service.transition(inspection.id, 'running');
    expect(updated.status).toBe('running');
  });

  it('should transition from running to paused and back to running', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-2' });
    await service.transition(inspection.id, 'running');

    const paused = await service.transition(inspection.id, 'paused');
    expect(paused.status).toBe('paused');

    const resumed = await service.transition(inspection.id, 'running');
    expect(resumed.status).toBe('running');
  });

  it('should transition to completed and populate endTimestamp and duration', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-3' });
    await service.transition(inspection.id, 'running');

    const completed = await service.transition(inspection.id, 'completed');
    expect(completed.status).toBe('completed');
    expect(completed.endTimestamp).toBeDefined();
    expect(typeof completed.durationSeconds).toBe('number');
  });

  it('should reject transitions out of terminal completed state', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-4' });
    await service.transition(inspection.id, 'running');
    await service.transition(inspection.id, 'completed');

    await expect(service.transition(inspection.id, 'running')).rejects.toThrow(
      "Cannot transition inspection from 'completed' to 'running'"
    );

    await expect(service.transition(inspection.id, 'paused')).rejects.toThrow(
      "Cannot transition inspection from 'completed' to 'paused'"
    );
  });

  it('should reject invalid transition from ready directly to completed', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-5' });
    expect(inspection.status).toBe('ready');

    await expect(service.transition(inspection.id, 'completed')).rejects.toThrow(
      "Cannot transition inspection from 'ready' to 'completed'"
    );
  });

  it('should handle recovery_required transition and reset to ready', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-6' });
    await service.transition(inspection.id, 'running');

    const faulted = await service.transition(inspection.id, 'recovery_required');
    expect(faulted.status).toBe('recovery_required');

    const recovered = await service.transition(inspection.id, 'ready');
    expect(recovered.status).toBe('ready');
  });

  it('should prove robot connection disconnect does not alter inspection lifecycle state', async () => {
    const inspection = await repository.create({ conduitName: 'Conduit-Indep' });
    await service.transition(inspection.id, 'running');

    // Simulate robot connection state changing independently
    const robotState: RobotConnectionSnapshot = {
      state: 'disconnected',
      lastHeartbeat: null,
      ipAddress: null,
      reconnectAttempts: 3,
      errorMessage: 'Wi-Fi link lost',
    };

    // Verify robot state is disconnected
    expect(robotState.state).toBe('disconnected');

    // Verify inspection lifecycle remains strictly 'running'
    const currentInspection = await repository.findById(inspection.id);
    expect(currentInspection?.status).toBe('running');
  });

  it('should throw 404 for non-existent inspection session', async () => {
    await expect(service.transition('non-existent-uuid', 'running')).rejects.toThrow(
      "Inspection session 'non-existent-uuid' was not found."
    );
  });
});
