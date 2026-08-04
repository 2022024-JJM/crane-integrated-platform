import { useCallback } from 'react';
import {
  addUploadedDocument,
  getAllCertifications,
  getAllOshaReports,
  getAllUploadedDocuments,
} from '@crane/domain/compliance';
import type { DocumentType, UploadedDocument } from '@crane/domain/compliance';
import { useDomainEventStore, useEntityTick } from '../shared/use-domain-event-store';

/** 문서 보관함 소스 — 자동 생성 보고서/인증서 + 사용자 업로드 */
export function useDocuments() {
  // 업로드 후 리렌더되도록 tick 구독
  useEntityTick('compliance');
  return {
    oshaReports: getAllOshaReports(),
    certifications: getAllCertifications(),
    uploads: getAllUploadedDocuments(),
  };
}

export interface UploadDocumentInput {
  fileName: string;
  docType: DocumentType;
  craneId?: string;
  craneName?: string;
  uploadedBy: string;
  sizeBytes: number;
  /** 세션 내 실파일 다운로드용 object URL */
  objectUrl?: string;
  /** 서비스 요청 첨부인 경우 WO 번호 */
  refWoNumber?: string;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 문서 업로드 — 메타데이터만 등록하고 tick을 발행한다 */
export function useUploadDocument(): (input: UploadDocumentInput) => UploadedDocument {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (input: UploadDocumentInput) => {
      const doc: UploadedDocument = {
        id: `doc-${Date.now().toString(36)}`,
        fileName: input.fileName,
        docType: input.docType,
        craneId: input.craneId,
        craneName: input.craneName,
        uploadedBy: input.uploadedBy,
        uploadedAt: todayIso(),
        sizeBytes: input.sizeBytes,
        objectUrl: input.objectUrl,
        refWoNumber: input.refWoNumber,
      };
      addUploadedDocument(doc);
      publish('compliance');
      return doc;
    },
    [publish],
  );
}
