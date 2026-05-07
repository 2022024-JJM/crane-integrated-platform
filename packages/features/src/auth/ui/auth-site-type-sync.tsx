import { useEffect } from 'react';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { useAuth } from '../lib/auth-context';

export function AuthSiteTypeSync() {
  const { user } = useAuth();
  const { setSiteType } = useSiteType();

  useEffect(() => {
    if (!user) return;
    // role → siteType 매핑: goliath → goliath-crane, philly/mro → philly-shipyard, ocean → hanwha-ocean
    const next =
      user.role === 'goliath'
        ? 'goliath-crane'
        : user.role === 'philly' || user.role === 'mro'
          ? 'philly-shipyard'
          : 'hanwha-ocean';
    setSiteType(next);
  // user 객체 참조가 아닌 role 값이 바뀔 때만 재실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, setSiteType]);

  return null;
}
