import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto border border-pipeborder rounded-sm bg-white shadow-industrial-subtle">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-xs text-left border-collapse', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn('bg-cream-100 border-b border-pipeborder font-mono uppercase text-[11px] text-pipeblack-muted tracking-wider', className)}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-pipeborder/60', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('hover:bg-cream-50 transition-colors data-[state=selected]:bg-cream-100', className)}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn('h-9 px-3.5 font-bold text-pipeblack align-middle whitespace-nowrap', className)}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('p-3.5 align-middle text-pipeblack text-xs font-normal whitespace-nowrap', className)}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export interface TableEmptyProps {
  colSpan: number;
  message?: string;
  icon?: ReactNode;
}

export const TableEmpty = ({
  colSpan,
  message = 'No records available in this view.',
  icon,
}: TableEmptyProps) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center text-pipeblack-muted text-xs">
      <div className="flex flex-col items-center justify-center gap-2">
        {icon}
        <span className="font-mono text-xs">{message}</span>
      </div>
    </td>
  </tr>
);

