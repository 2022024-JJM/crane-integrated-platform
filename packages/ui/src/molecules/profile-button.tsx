import { UserCircle, LogOut } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { Separator } from '../atoms/separator';
import { Popover, PopoverTrigger, PopoverPopup, PopoverClose } from './popover';

export type ProfileUserRole = 'philly' | 'ocean' | 'goliath';

export interface ProfileUser {
  id: string;
  role: ProfileUserRole;
}

const ROLE_LABEL: Record<ProfileUserRole, string> = {
  ocean: 'Ocean',
  goliath: 'Goliath',
  philly: 'Philly',
};

const ROLE_BADGE_CLASS: Record<ProfileUserRole, string> = {
  ocean: 'bg-blue-500/15 text-blue-400',
  goliath: 'bg-purple-500/15 text-purple-400',
  philly: 'bg-green-500/15 text-green-400',
};

interface ProfileButtonProps {
  user: ProfileUser;
  onLogout: () => void;
}

export function ProfileButton({ user, onLogout }: ProfileButtonProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="프로필"
      >
        <UserCircle className="h-5 w-5" />
      </PopoverTrigger>

      <PopoverPopup className="min-w-50 p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.id}
            </p>
            <span
              className={cn(
                'w-fit rounded-full px-2 py-0.5 text-[10px] font-medium',
                ROLE_BADGE_CLASS[user.role],
              )}
            >
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>

        <Separator />

        <div className="p-1">
          <PopoverClose
            onClick={onLogout}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm',
              'text-destructive hover:bg-destructive/10',
              'transition-colors outline-none focus-visible:bg-destructive/10',
            )}
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </PopoverClose>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
