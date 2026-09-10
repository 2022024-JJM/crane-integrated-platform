import { useState } from 'react';
import { Input } from '@crane/ui/atoms/input';

/**
 * 가상 태그 표의 자유 텍스트 셀(이름·단위) — **편집 중에는 친 그대로** 보여
 * 주고, 포커스를 떠날 때 저장된 값으로 돌아간다.
 *
 * 그냥 제어 입력으로 두면 스토어가 매 글자마다 `sanitizeVirtualTag` 를 태우고
 * 그 안의 `trim()` 이 끝 공백을 잘라, **문자 끝에서 스페이스를 치면 값이
 * 그대로라 화면에 안 찍힌다**(실측 2026-09-10 — 단어 사이 공백은 되는데 끝만
 * 안 되는 증상). sanitize 는 저장·로드되는 데이터의 방어선이라 trim 이 맞고,
 * 고칠 곳은 "타이핑 중간 상태" 를 제어 입력이 되돌려 버리는 쪽이다.
 *
 * 값은 계속 위로 올린다 — 미저장 표시와 저장 버튼이 살아 있어야 한다. 초안은
 * 화면 표시에만 쓰이고 blur 에서 버려지므로 끝 공백은 저장 시점에 정상적으로
 * 잘린다. `InputNumber` 의 draft 와 같은 방식이다.
 *
 * 스토어가 값을 **거부**하는 경우(길이 상한 초과 등)에도 blur 하면 저장된
 * 값이 드러나므로, 화면과 데이터가 어긋난 채로 남지 않는다.
 */
export function TextCell({
  value,
  className,
  onChange,
}: {
  value: string;
  className?: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      value={draft ?? value}
      className={className}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
