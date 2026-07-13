// 대상 사이트(필라델피아 조선소)의 실제 타임존으로 고정.
// 'YYYY-MM-DD'를 new Date()로 파싱하면 UTC 자정이 되어 미 동부에서 하루 밀리는
// 버그가 있었으므로, 테스트는 항상 음수 오프셋 타임존에서 돌려 회귀를 잡는다.
process.env.TZ = 'America/New_York';
