import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import type { Location } from '../../../../shared/entities/location/model/types'
import type { LidarBlockInfo } from '../../../../shared/features/bay-viewer/model/lidarBlock'
/* 모듈 i18n 조각은 앱 bootstrap 이 등록한다 — 테스트에서는 손으로 등록한다 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { assemblyKo } = await import('../../i18n/ko')
const { assemblyEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', assemblyKo, true, true)
i18n.addResourceBundle('en', 'inshop', assemblyEn, true, true)

const { BayIdentityBar } = await import('../BayIdentityBar')

/**
 * **정반 식별바 — 한 정반에 블록이 여럿일 수 있다** (D1, W9-0 진단 #1·#2·#4).
 *
 * 실측 5BAY 는 mock 정반 배정이 없고(로스터 불변식) 대신 스캔이 정합한 조립품들이
 * 호선·블록을 실어 온다. 예전에는 배정만 읽어 `— / —` 을 내놓고 통합실적 링크도
 * 세우지 않았다. 지금은 인식 결과에서 신원을 읽고, 여럿이면 여럿으로 말한다.
 */
const bay = (over: Partial<Location> = {}): Location => ({
  id: 'asm-pbs-b5',
  factoryId: 'asm-pbs',
  name: '5번 베이',
  status: 'occupied',
  workCntr: 'PB5B',
  ...over,
})

const detection = (projNo: string, blkNo: string, assySerNo: string | null): LidarBlockInfo =>
  ({
    id: `${projNo}_${blkNo}_${assySerNo}`,
    locationId: 'asm-pbs-b5',
    projNo,
    blkNo,
    assySerNo,
    blockName: assySerNo ? `중조립품 ${assySerNo}` : `대조립 블록 ${blkNo}`,
    wstgCode: '----',
    cadRegistered: true,
    plan: null,
    confidence: 0.9,
    dimensions: { length: 1, width: 1, height: 1 },
    transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    history: [],
  }) as LidarBlockInfo

describe('배정이 있는 정반 (목업) — 종전 그대로', () => {
  it('배정된 호선·블록을 그대로 적고 통합실적 링크를 세운다', () => {
    renderWithProviders(
      <BayIdentityBar
        location={bay({ id: 'asm-pbs-b4', name: '4번 베이', workCntr: 'PB4B', projNo: '2570', blkNo: '153' })}
        blocks={[detection('2570', '153', 'DK1A')]}
      />
    )
    expect(screen.getByText('2570')).toBeInTheDocument()
    expect(screen.getByText('153')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /통합실적/ })).toHaveAttribute(
      'href',
      expect.stringContaining('vessel=2570')
    )
  })
})

describe('배정이 없는 실측 정반 — 인식 결과에서 신원을 읽는다', () => {
  const realBlocks = [
    detection('5510', '553', 'FR103C'),
    detection('5510', '553', 'FR104C'),
    detection('5510', '726', 'SR1B'),
    detection('5510', '736', 'SR2B'),
  ]

  it("호선은 하나면 하나로, 블록이 여럿이면 '외 n' 으로 말한다", () => {
    renderWithProviders(<BayIdentityBar location={bay()} blocks={realBlocks} />)
    expect(screen.getByText('5510')).toBeInTheDocument()
    /* 553 · 726 · 736 → `553 외 2` */
    expect(screen.getByText('553 외 2')).toBeInTheDocument()
    /* 예전의 '—' 로 돌아가면 여기서 걸린다 */
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('통합실적 링크가 세 블록을 모두 실어 보낸다 (하나만 보내면 나머지가 조회에서 빠진다)', () => {
    renderWithProviders(<BayIdentityBar location={bay()} blocks={realBlocks} />)
    const href = screen.getByRole('link', { name: /통합실적/ }).getAttribute('href')!
    expect(href).toContain('vessel=5510')
    for (const block of ['553', '726', '736']) expect(href).toContain(block)
  })

  it('인식이 하나도 없으면 신원을 지어내지 않는다', () => {
    renderWithProviders(<BayIdentityBar location={bay({ status: 'empty' })} blocks={[]} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /통합실적/ })).not.toBeInTheDocument()
  })
})
