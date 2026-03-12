import {
  INDOOR_WORK_CRANE_ROWS,
  INDOOR_WORK_OPERATION_INFO_ROWS,
  INDOOR_WORK_OPERATION_STATUS_ROWS,
} from '@/pages/indoor-work/config/indoor-work-content';
import type { IndoorMenuKey } from '@/pages/indoor-work/model/types';
import {
  tableCellClass,
  tableHeadClass,
} from '@/pages/indoor-work/ui/indoor-work-page.styles';
import { cn } from '@/shared/lib/utils';

interface IndoorWorkBottomPanelProps {
  activeMenu: IndoorMenuKey;
}

export function IndoorWorkBottomPanel({
  activeMenu,
}: IndoorWorkBottomPanelProps) {
  if (activeMenu === 'operation-info') {
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['장비', '유형', '위치', '상태', '작업', '방향'].map((header) => (
              <th key={header} className={tableHeadClass}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INDOOR_WORK_OPERATION_INFO_ROWS.map((row) => (
            <tr key={row[0]}>
              <td
                className={cn(
                  tableCellClass,
                  'text-left font-bold text-[var(--outdoor-page-table-emphasis)]',
                )}
              >
                {row[0]}
              </td>
              <td className={tableCellClass}>{row[1]}</td>
              <td className={tableCellClass}>{row[2]}</td>
              <td className={tableCellClass}>{row[3]}</td>
              <td className={tableCellClass}>{row[4]}</td>
              <td
                className={cn(
                  tableCellClass,
                  'font-bold text-[var(--outdoor-page-table-emphasis)]',
                )}
              >
                {row[5]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (activeMenu === 'operation-status') {
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['시각', '장비', '상태 변화', '레벨', '위치'].map((header) => (
              <th key={header} className={tableHeadClass}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INDOOR_WORK_OPERATION_STATUS_ROWS.map((row) => (
            <tr key={`${row[0]}-${row[1]}`}>
              <td className={tableCellClass}>{row[0]}</td>
              <td
                className={cn(
                  tableCellClass,
                  'text-left font-bold text-[var(--outdoor-page-table-emphasis)]',
                )}
              >
                {row[1]}
              </td>
              <td className={tableCellClass}>{row[2]}</td>
              <td
                className={cn(
                  tableCellClass,
                  row[3] !== '정상' &&
                    'font-bold text-[var(--outdoor-page-table-emphasis)]',
                )}
              >
                {row[3]}
              </td>
              <td className={tableCellClass}>{row[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {[
            'Crane',
            'Comm',
            'On',
            'Fault',
            'Not Comm',
            'Free Slewing',
            'Rotate',
            'Trolley #1',
            'Trolley #2',
            'Gantry',
            'Hoist #1',
            'Hoist #2',
            'Hoist #3',
            'Trolley #2',
            'Slewing',
            'Gantry',
          ].map((header) => (
            <th key={header} className={tableHeadClass}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {INDOOR_WORK_CRANE_ROWS.map((row) => (
          <tr key={row[0]}>
            <td
              className={cn(
                tableCellClass,
                'text-left font-bold text-[var(--outdoor-page-table-emphasis)]',
              )}
            >
              {row[0]}
            </td>
            {[row[1], row[2], row[3]].map((value, index) => (
              <td key={index} className={tableCellClass}>
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full bg-[var(--outdoor-page-dot-idle)]',
                    value === true &&
                      index < 2 &&
                      'bg-[var(--outdoor-page-dot-ok)] shadow-[var(--outdoor-page-dot-ok-shadow)]',
                    value === true &&
                      index === 2 &&
                      'bg-[var(--outdoor-page-dot-danger)] shadow-[var(--outdoor-page-dot-danger-shadow)]',
                  )}
                />
              </td>
            ))}
            {[0, 1, 2].map((index) => (
              <td key={`dot-${index}`} className={tableCellClass}>
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--outdoor-page-dot-idle)]" />
              </td>
            ))}
            {row.slice(7, 15).map((value, index) => (
              <td key={index} className={tableCellClass}>
                {value}
              </td>
            ))}
            <td
              className={cn(
                tableCellClass,
                'font-bold text-[var(--outdoor-page-table-emphasis)]',
              )}
            >
              {row[15]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
