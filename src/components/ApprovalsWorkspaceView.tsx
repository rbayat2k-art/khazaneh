import {AccountInquiryRequestButton}from'./AccountInquiryContext';
import {currentSupervisorId,currentSupervisorName} from '../utils/request-approval-chain';
import {CostCenterSelect} from './CostCenterSelect';
import {RialInput} from './RialInput';
import {RequestSummaryHeaders,RequestSummaryRow,REQUEST_SUMMARY_COLUMN_COUNT} from './RequestSummaryTable';
import {useRequestDetails} from './RequestDetails';
import {requestRecordSortFields} from '../utils/request-details';
import {requestCostCenters} from '../utils/request-cost-center';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {OfficialReviewNotes} from './OfficialReviewNotes';
import {reviewEditError} from '../utils/review-edit';
import {
  Check,
  X,
  Search,
  AlertCircle,
  Paperclip,
  Edit,
  Save,
  CheckCircle2,
  RefreshCw,
  Clock,
  Download,
  History,
  RotateCcw,
  FileCheck2,
  Layers,
  UserCheck,
} from 'lucide-react';
import type {
  AdvanceRequest,
  PaymentRequest,
  BatchPaymentRequest,
  User,
  AttachmentFile,
  ReviewComment,
  ItemAuditEntry,
  ApprovalCategoryTab,
  RequestStatus,
  ReviewRejection,
  CostCenterItem,
} from '../types/treasury';
import {
  useSortableTable,
  formatRial,
  getStatusLabel,
  normalizePersianText,
} from '../utils/sorting';
import { SortableHeader } from './SortableHeader';
import { ownsOpenRejection, rejectionDescription } from '../utils/review-rejection';
import {requestTimeFields,type RequestTimeFields} from '../utils/record-time';
import {RequestTimeHeaders,RequestTimeCells,RequestTimeHelp} from './RequestTimeColumns';

export interface ApproverPendingRow extends RequestTimeFields {
  uid: string; // unique key e.g. BATCH_ITEM:bat-101:item-1 or PAYMENT:pay-201
  itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
  subKind: 'PAYMENT' | 'ADVANCE'; // whether the underlying request is a payment order or salary advance
  isGroupRow: boolean;
  requestId: string;
  rowId?: string;
  trackingCode: string;
  parentBatchTitle?: string | null;
  parentBatchCode?: string | null;
  typeLabel: string;
  payeeName: string;
  requesterId: string;
  requesterName: string;
  department: string;
  company?: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  amount: number;
  initialAmount: number;
  approvedAmount: number | null;
  destinationBank: string;
  accountOrCard?: string;
  iban?: string;
  description: string;
  costCenter?:string;
  invoiceNumber?: string;
  status: RequestStatus;
  reviewRejection?: ReviewRejection;
  version: number;
  isResubmitted: boolean;
  resubmittedAt?: string | null;
  attachments?: AttachmentFile[];
  comments?: ReviewComment[];
  auditHistory?: ItemAuditEntry[];
  returnedReason?: string | null;
  returnedById?: string | null;
  returnedByRole?: string | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  approverId?: string | null;
  approverName?: string | null;
  approverDecidedAt?: string | null;
  approverApprovedVersion?: number | null;
  approverNote?: string | null;
  accountingId?: string | null;
  accountingName?: string | null;
  accountingDecidedAt?: string | null;
  accountingApprovedVersion?: number | null;
  accountingNote?: string | null;
  paidBankName?: string | null;
  paidDateJalali?: string | null;
  // Derived fields for current reviewer's history:
  myApprovedDecision?: {
    decidedAt: string;
    note: string;
    approvedVersion: number;
    isInvalidatedByLaterRevision: boolean;
  } | null;
  myReturnedDecision?: {
    decidedAt: string;
    reason: string;
    isCurrentlyWaitingRevision: boolean;
  } | null;
  myLastActionAt?: string | null;
  myLastActionSummary?: string | null;
  myLastNoteOrReason?: string | null;
  nextStageAssignee: string;
  supervisorStageStatus: string;
  accountingStageStatus: string;
  treasuryStageStatus: string;
}

interface ApprovalsWorkspaceViewProps {
  mode: 'APPROVER' | 'ACCOUNTING';
  currentUser: User;
  advanceRequests: AdvanceRequest[];
  paymentRequests: PaymentRequest[];
  batchPayments: BatchPaymentRequest[];
  costCenters:CostCenterItem[];
  companies:Array<{id:string;name:string}>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  initialCategoryTab?: ApprovalCategoryTab;
  onCategoryTabChange?: (tab: ApprovalCategoryTab) => void;
  onRowReviewAction: (payload: {
    reviewerId: string;
    reviewStage: 'APPROVER' | 'ACCOUNTING';
    expectedVersion: number;
    expectedStatus?: RequestStatus;
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    action: 'APPROVE' | 'RETURN_FOR_REVISION' | 'UPDATE_AMOUNT_COMMENT' | 'UPDATE_AND_APPROVE' | 'REJECT' | 'CLOSE_REJECTED';
    comment?: string;
    returnReason?: string;
    newAmount?: number;
    amountChangeReason?: string;
    newCostCenterId?:string;
  }) => Promise<boolean>;
  onBulkReviewAction: (payload: {
    reviewerId: string;
    reviewStage: 'APPROVER' | 'ACCOUNTING';
    action: 'APPROVE' | 'RETURN_FOR_REVISION' | 'REJECT';
    returnReason?: string;
    items: Array<{
      itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
      requestId: string;
      rowId?: string;
      expectedVersion: number;
      expectedStatus?: RequestStatus;
    }>;
  }) => Promise<{
    success: boolean;
    successCount?: number;
    failedCount?: number;
    failures?: Array<{ id: string; reason: string }>;
    succeededUids?: string[];
  } | boolean>;
}

export const ApprovalsWorkspaceView: React.FC<ApprovalsWorkspaceViewProps> = ({
  mode,
  currentUser,
  advanceRequests,
  paymentRequests,
  batchPayments,
  costCenters,
  companies,
  searchInputRef,
  initialCategoryTab = 'PENDING',
  onCategoryTabChange,
  onRowReviewAction,
  onBulkReviewAction,
}) => {
  const requestDetails=useRequestDetails();
  const [categoryTab, setCategoryTab] = useState<ApprovalCategoryTab>(initialCategoryTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'ALL' | 'BATCH_ITEMS' | 'PAYMENTS' | 'ADVANCES' | 'SINGLE_ONLY'
  >('ALL');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResultFeedback, setBulkResultFeedback] = useState<{
    successCount: number;
    failedCount: number;
    failures: Array<{ id: string; reason: string }>;
  } | null>(null);

  // Edit Amount & Comment Modal State
  const [editingRow, setEditingRow] = useState<ApproverPendingRow | null>(null);
  const [editAmountVal, setEditAmountVal] = useState<string>('');
  const editAmountInput=useRef<HTMLInputElement>(null);
  const [editAmountReason, setEditAmountReason] = useState<string>('');
  const [editCommentText, setEditCommentText] = useState<string>('');
  const [editError,setEditError]=useState('');
  const [editCostCenterId,setEditCostCenterId]=useState('');
  const editingRecord=editingRow?requestDetails.resolve({kind:editingRow.itemType,id:editingRow.requestId,rowId:editingRow.rowId}):null;
  const editingCenters=editingRecord?requestCostCenters(costCenters,companies,editingRecord.parent,editingRecord.company):[];
  const canEdit=currentUser.role==='ADMIN'||!!currentUser.effectivePermissions?.canEditAmount;
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Return For Revision Modal State
  const [returnTargetRows, setReturnTargetRows] = useState<ApproverPendingRow[] | null>(null);
  const [returnReasonText, setReturnReasonText] = useState<string>('');
  const [isReturning, setIsReturning] = useState(false);
  const [reasonAction, setReasonAction] = useState<'RETURN_FOR_REVISION'|'REJECT'|'CLOSE_REJECTED'>('RETURN_FOR_REVISION');
  const reasonTitle = reasonAction === 'REJECT' ? 'رد درخواست' : reasonAction === 'CLOSE_REJECTED' ? 'بستن نهایی درخواست' : 'برگشت ردیف جهت اصلاح';
  const canReject = currentUser.role === 'ADMIN' || Boolean(currentUser.effectivePermissions?.canReturnForRevision);
  const canApprove = currentUser.role === 'ADMIN' || Boolean(currentUser.effectivePermissions?.canApprove);

  useEffect(() => {
    if(!returnTargetRows)return;
    const prior=document.activeElement as HTMLElement|null;
    const dialog=document.getElementById('review-reason-dialog');
    dialog?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!isReturning){event.preventDefault();setReturnTargetRows(null);}
      if(event.key==='Tab'&&dialog){
        const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)'));
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prior?.focus();};
  },[returnTargetRows,isReturning]);

  // Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentFile | null>(null);

  // Row Full Audit History Modal


  useEffect(() => {
    if (initialCategoryTab) {
      setCategoryTab(initialCategoryTab);
    }
  }, [initialCategoryTab]);

  // Clear selection when switching category tabs
  const handleSelectCategoryTab = (tab: ApprovalCategoryTab) => {
    setCategoryTab(tab);
    setSelectedUids([]);
    setBulkResultFeedback(null);
    if (onCategoryTabChange) {
      onCategoryTabChange(tab);
    }
  };

  const targetPendingStatus: RequestStatus =
    mode === 'APPROVER' ? 'Pending_Approver' : 'Pending_Accounting';

  // Scope and eligibility check for current reviewer
  const isWithinReviewerScope = (item: {
    requesterId: string;
    supervisorId?: string | null;
    department?: string;
    company?: string;
  }) => {
    const scope = currentUser.effectiveAccessScope || currentUser.accessScope;
    if (currentUser.role === 'ADMIN') return true;

    if (mode === 'APPROVER') {
      // Approver cannot approve their own requests
      if (item.requesterId === currentUser.id) return false;
      if (scope === 'COMPANY_WIDE') return item.supervisorId === currentUser.id || !item.supervisorId;
      if (scope === 'DEPARTMENT' && item.department === currentUser.department) {
        return item.supervisorId === currentUser.id || !item.supervisorId;
      }
      return item.supervisorId === currentUser.id || !item.supervisorId;
    }

    // ACCOUNTING mode
    if (item.requesterId === currentUser.id) return false;
    if (scope === 'SELF_ONLY') return false;
    if (scope === 'DEPARTMENT' && item.department && item.department !== currentUser.department) {
      return false;
    }
    return true;
  };

  // Helper to compute independent stage statuses & next stage assignee
  const computeStageInfo = (params: {
    status: RequestStatus;
    reviewRejection?: ReviewRejection;
    hasSupervisorStage: boolean;
    supervisorName?: string | null;
    approverNote?: string | null;
    accountingName?: string | null;
    accountingNote?: string | null;
    paidBankName?: string | null;
    returnedByRole?: string | null;
    returnedReason?: string | null;
    requesterName: string;
  }) => {
    const {
      status,
      supervisorName,
      approverNote,
      accountingName,
      accountingNote,
      paidBankName,
      returnedByRole,
      requesterName,
    } = params;

    let supervisorStageStatus = 'در انتظار بررسی سرپرست';
    let accountingStageStatus = 'مرحله بعد (پس از سرپرست)';
    let treasuryStageStatus = 'ورود نیافته به صف خزانه';
    let nextStageAssignee = supervisorName ? `${supervisorName} (سرپرست واحد)` : 'سرپرست واحد';

    if (status === 'Pending_Approver') {
      supervisorStageStatus = 'در انتظار تأیید سرپرست';
      accountingStageStatus = 'در انتظار تأیید مرحله قبل';
      treasuryStageStatus = 'غيرفعال';
      nextStageAssignee = supervisorName ? `${supervisorName} (سرپرست واحد)` : 'سرپرست واحد';
    } else if (status === 'Pending_Accounting') {
      supervisorStageStatus = `تأیید شده (${supervisorName || 'سرپرست'})`;
      accountingStageStatus = 'در انتظار بررسی مالی حسابداری';
      treasuryStageStatus = 'در انتظار تأیید حسابداری';
      nextStageAssignee = 'واحد بررسی مالی و حسابداری';
    } else if (status === 'Pending_Treasury') {
      supervisorStageStatus = `تأیید شده (${supervisorName || 'سرپرست'})`;
      accountingStageStatus = `تأیید مالی شده (${accountingName || 'حسابداری'})`;
      treasuryStageStatus = 'در صف انتظار پرداخت خزانه';
      nextStageAssignee = 'واحد خزانه‌داری و پرداخت';
    } else if (status === 'In_Payment') {
      supervisorStageStatus = `تأیید شده (${supervisorName || 'سرپرست'})`;
      accountingStageStatus = `تأیید مالی شده (${accountingName || 'حسابداری'})`;
      treasuryStageStatus = 'در حال پرداخت (مخزن خزانه)';
      nextStageAssignee = 'خزانه‌دار (در حال اجرای پرداخت)';
    } else if (status === 'Paid') {
      supervisorStageStatus = `تأیید شده (${supervisorName || 'سرپرست'})`;
      accountingStageStatus = `تأیید مالی شده (${accountingName || 'حسابداری'})`;
      treasuryStageStatus = `پرداخت قطعی (${paidBankName || 'خزانه'})`;
      nextStageAssignee = 'تکمیل و تسویه شده';
    } else if (status === 'Needs_Revision') {
      if (returnedByRole === 'TREASURY') {
        supervisorStageStatus = 'تأیید سرپرست محفوظ است';
        accountingStageStatus = 'تأیید مالی محفوظ است';
      } else if (returnedByRole === 'ACCOUNTING' || approverNote) {
        supervisorStageStatus = 'تأیید قبلی (نیازمند بررسی مجدد پس از اصلاح)';
        accountingStageStatus = 'برگشت داده شده برای اصلاح';
      } else {
        supervisorStageStatus = 'برگشت داده شده برای اصلاح';
        accountingStageStatus = 'متوقف تا اصلاح متقاضی';
      }
      treasuryStageStatus = 'متوقف';
      nextStageAssignee = returnedByRole==='TREASURY'?'گیرندهٔ منتخب خزانه — اصلاح فنی و بازگشت مستقیم به خزانه':`${requesterName} (متقاضی — جهت اصلاح و ارسال مجدد)`;
    } else if (status === 'Rejected' || status === 'Closed') {
      supervisorStageStatus = params.reviewRejection?.stage === 'ACCOUNTING' ? 'تأیید مرحله سرپرست' : 'رد درخواست';
      accountingStageStatus = params.reviewRejection?.stage === 'ACCOUNTING' ? 'رد درخواست' : 'متوقف';
      treasuryStageStatus = 'غیرقابل پرداخت';
      nextStageAssignee = status === 'Closed' ? 'بسته و بایگانی‌شده' : params.reviewRejection?.byName || 'مالک رد درخواست مشخص نیست؛ اقدام مجاز نیست';
    }

    return {
      supervisorStageStatus: !params.hasSupervisorStage && status !== 'Pending_Approver' ? 'بدون مرحله سرپرست؛ مستقیم به حسابداری' : supervisorStageStatus,
      accountingStageStatus,
      treasuryStageStatus,
      nextStageAssignee,
    };
  };

  // Helper to extract this reviewer's real decision history on a specific row
  const extractMyDecisionHistory = (params: {
    approvalChain?: import('../utils/request-approval-chain').ApprovalChain;
    status: RequestStatus;
    version: number;
    auditHistory: ItemAuditEntry[];
    supervisorId?: string | null;
    supervisorName?: string | null;
    approverId?: string | null;
    approverName?: string | null;
    approverDecidedAt?: string | null;
    approverApprovedVersion?: number | null;
    approverNote?: string | null;
    accountingId?: string | null;
    accountingName?: string | null;
    accountingDecidedAt?: string | null;
    accountingApprovedVersion?: number | null;
    accountingNote?: string | null;
    returnedById?: string | null;
    returnedByRole?: string | null;
    returnedByName?: string | null;
    returnedAt?: string | null;
    returnedReason?: string | null;
  }) => {
    const {
      status,
      version,
      auditHistory,
      supervisorId,
      approverId,
      approverDecidedAt,
      approverApprovedVersion,
      approverNote,
      accountingId,
      accountingDecidedAt,
      accountingApprovedVersion,
      accountingNote,
      returnedById,
      returnedByRole,
      returnedByName,
      returnedAt,
      returnedReason,
    } = params;

    const isMyAuditEntry = (entry: ItemAuditEntry) => {
      if(params.approvalChain)return entry.actorId===currentUser.id;
      if (entry.actorId && entry.actorId === currentUser.id) return true;
      if (entry.changedBy && entry.changedBy === currentUser.name) return true;
      if (currentUser.role === 'ADMIN' && entry.stage === mode) return true;
      return false;
    };

    const isStageApprovalEntry = (entry: ItemAuditEntry) => {
      if (entry.decision === 'APPROVE') {
        return !entry.stage || entry.stage === mode;
      }
      if (entry.action.includes('تایید') || entry.action.includes('تأیید')) {
        if (mode === 'APPROVER') {
          return (
            entry.action.includes('APPROVER') ||
            entry.action.includes('سرپرست') ||
            isMyAuditEntry(entry)
          );
        }
        return (
          entry.action.includes('ACCOUNTING') ||
          entry.action.includes('حسابداری') ||
          isMyAuditEntry(entry)
        );
      }
      return false;
    };

    const isStageReturnEntry = (entry: ItemAuditEntry) => {
      if (entry.decision === 'RETURN_FOR_REVISION') {
        return !entry.stage || entry.stage === mode;
      }
      return entry.action.includes('برگشت');
    };

    // 1. Check if approved by me in this stage
    let myApprovedDecision: ApproverPendingRow['myApprovedDecision'] = null;
    const approvalEntries = auditHistory.filter(
      (e) => isStageApprovalEntry(e) && isMyAuditEntry(e)
    );

    if (approvalEntries.length > 0) {
      const latestApp = approvalEntries[approvalEntries.length - 1];
      const appVer =
        latestApp.version ??
        (mode === 'APPROVER' ? approverApprovedVersion : accountingApprovedVersion) ??
        1;
      const activeChainDecision=mode==='APPROVER'&&params.approvalChain?.decisions.some(d=>d.round===params.approvalChain!.round&&d.actorId===currentUser.id);
      const isInvalidated = activeChainDecision?false:
        Boolean(latestApp.invalidatedByVersion) ||
        (status === 'Needs_Revision' && returnedByRole !== 'TREASURY') ||
        (mode === 'APPROVER' && status === 'Pending_Approver' && version > appVer) ||
        (mode === 'ACCOUNTING' &&
          (status === 'Pending_Approver' || status === 'Pending_Accounting') &&
          version > appVer);

      myApprovedDecision = {
        decidedAt:
          latestApp.changedAt ||
          (mode === 'APPROVER' ? approverDecidedAt : accountingDecidedAt) ||
          'ثبت در تاریخچه',
        note:
          latestApp.comment ||
          (mode === 'APPROVER' ? approverNote : accountingNote) ||
          latestApp.action,
        approvedVersion: appVer,
        isInvalidatedByLaterRevision: isInvalidated,
      };
    } else if (mode === 'APPROVER'&&!params.approvalChain) {
      const passedSupervisorStage =
        status === 'Pending_Accounting' ||
        status === 'Pending_Treasury' ||
        status === 'In_Payment' ||
        status === 'Paid';
      const isAssignedSupervisor =
        approverId === currentUser.id ||
        supervisorId === currentUser.id ||
        currentUser.role === 'ADMIN';
      if (isAssignedSupervisor && (passedSupervisorStage || Boolean(approverNote))) {
        const appVer = approverApprovedVersion ?? version;
        const isInvalidated =
          (status === 'Needs_Revision' && returnedByRole !== 'TREASURY') ||
          (status === 'Pending_Approver' && version > appVer);
        myApprovedDecision = {
          decidedAt: approverDecidedAt || 'ثبت در مرحله سرپرست',
          note: approverNote || 'تأیید سرپرست واحد',
          approvedVersion: appVer,
          isInvalidatedByLaterRevision: isInvalidated,
        };
      }
    } else if (mode === 'ACCOUNTING') {
      const passedAccountingStage =
        status === 'Pending_Treasury' || status === 'In_Payment' || status === 'Paid';
      const isAssignedAccounting =
        accountingId === currentUser.id ||
        (!accountingId && (currentUser.role === 'ACCOUNTING' || currentUser.role === 'ADMIN'));
      if (isAssignedAccounting && (passedAccountingStage || Boolean(accountingNote))) {
        const appVer = accountingApprovedVersion ?? version;
        const isInvalidated =
          (status === 'Needs_Revision' && returnedByRole !== 'TREASURY') ||
          status === 'Pending_Approver' ||
          (status === 'Pending_Accounting' && version > appVer);
        myApprovedDecision = {
          decidedAt: accountingDecidedAt || 'ثبت در مرحله حسابداری',
          note: accountingNote || 'تأیید مالی حسابداری',
          approvedVersion: appVer,
          isInvalidatedByLaterRevision: isInvalidated,
        };
      }
    }

    // 2. Check if returned by me
    let myReturnedDecision: ApproverPendingRow['myReturnedDecision'] = null;
    const returnEntries = auditHistory.filter(
      (e) => isStageReturnEntry(e) && isMyAuditEntry(e)
    );
    const matchesCurrentReturn =
      returnedByRole === mode &&
      (returnedById === currentUser.id ||
        returnedByName === currentUser.name ||
        (!returnedById && (currentUser.role === mode || currentUser.role === 'ADMIN')));

    if (matchesCurrentReturn && status === 'Needs_Revision') {
      myReturnedDecision = {
        decidedAt: returnedAt || 'ثبت برگشت',
        reason: returnedReason || 'نیازمند اصلاح اطلاعات / مدارک',
        isCurrentlyWaitingRevision: true,
      };
    } else if (returnEntries.length > 0) {
      const latestRet = returnEntries[returnEntries.length - 1];
      myReturnedDecision = {
        decidedAt: latestRet.changedAt,
        reason: latestRet.reason || returnedReason || latestRet.action,
        isCurrentlyWaitingRevision: status === 'Needs_Revision' && matchesCurrentReturn,
      };
    }

    // 3. Last action summary by me
    const myEntries = auditHistory.filter(isMyAuditEntry);
    const latestMyEntry = myEntries.length > 0 ? myEntries[myEntries.length - 1] : null;
    const myLastActionAt =
      latestMyEntry?.changedAt ||
      myReturnedDecision?.decidedAt ||
      myApprovedDecision?.decidedAt ||
      null;
    const myLastActionSummary =
      latestMyEntry?.action ||
      (myReturnedDecision?.isCurrentlyWaitingRevision
        ? 'برگشت جهت اصلاح'
        : myApprovedDecision
        ? 'تأیید شده'
        : null);
    const myLastNoteOrReason =
      (status === 'Needs_Revision' && myReturnedDecision?.reason) ||
      latestMyEntry?.reason ||
      latestMyEntry?.comment ||
      myApprovedDecision?.note ||
      myReturnedDecision?.reason ||
      null;

    return {
      myApprovedDecision,
      myReturnedDecision,
      myLastActionAt,
      myLastActionSummary,
      myLastNoteOrReason,
      hasAnyMyRecord: Boolean(
        myApprovedDecision || myReturnedDecision || myEntries.length > 0
      ),
    };
  };

  // Build complete unified rows across all requests in the system
  const allUnifiedRows: ApproverPendingRow[] = useMemo(() => {
    const list: ApproverPendingRow[] = [];

    // 1. Batch Items
    for (const b of batchPayments) {
      b.items.forEach((it, idx) => {
        const itemStatus = (it.status || b.status) as RequestStatus;
        const ver = it.version || 1;
        const audit = it.auditHistory || [];
        const isResub =
          Boolean(it.isResubmitted) ||
          (ver > 1 && audit.some((a) => a.decision === 'RESUBMIT' || a.action.includes('ارسال مجدد')));

        const effApproverId = it.approvedBySupervisorUserId || it.approverId || b.supervisorId;
        const effApproverName = it.approvedBySupervisorName || it.approverName || b.supervisorName;
        const effApproverAt = it.approvedBySupervisorAt || it.approverDecidedAt;
        const effAccountingId = it.approvedByAccountingUserId || it.accountingId;
        const effAccountingName = it.approvedByAccountingName || it.accountingName;
        const effAccountingAt = it.approvedByAccountingAt || it.accountingDecidedAt;
        const effReturnedById = it.returnedByUserId || it.returnedById;

        const stageInfo = computeStageInfo({
          status: itemStatus,
          reviewRejection: it.reviewRejection,
          hasSupervisorStage: Boolean(b.supervisorId || it.approvedBySupervisorUserId),
          supervisorName: currentSupervisorName(b,it)||effApproverName,
          approverNote: it.approverNote || b.approverNote,
          accountingName: effAccountingName || 'حسابداری',
          accountingNote: it.accountingNote || b.accountingNote,
          paidBankName: it.paidBankName || b.paidBankName,
          returnedByRole: it.returnedByRole || null,
          returnedReason: it.returnedReason || b.returnedReason,
          requesterName: b.requesterName,
        });

        const decisionInfo = extractMyDecisionHistory({
          approvalChain:it.approvalChain,
          status: itemStatus,
          version: ver,
          auditHistory: audit,
          supervisorId: currentSupervisorId(b,it),
          supervisorName: currentSupervisorName(b,it),
          approverId: effApproverId,
          approverName: effApproverName,
          approverDecidedAt: effApproverAt,
          approverApprovedVersion: it.approverApprovedVersion,
          approverNote: it.approverNote || b.approverNote,
          accountingId: effAccountingId,
          accountingName: effAccountingName,
          accountingDecidedAt: effAccountingAt,
          accountingApprovedVersion: it.accountingApprovedVersion,
          accountingNote: it.accountingNote || b.accountingNote,
          returnedById: effReturnedById,
          returnedByRole: it.returnedByRole,
          returnedByName: it.returnedByName,
          returnedAt: it.returnedAt,
          returnedReason: it.returnedReason,
        });
        if (decisionInfo.myApprovedDecision && it.invalidatedPriorApproval) {
          decisionInfo.myApprovedDecision.isInvalidatedByLaterRevision = true;
        }

        list.push({
          uid: `BATCH_ITEM:${b.id}:${it.id}`,
          ...requestTimeFields(b,[it]),
          itemType: 'BATCH_ITEM',
          subKind: b.batchType === 'ADVANCE' ? 'ADVANCE' : 'PAYMENT',
          isGroupRow: true,
          requestId: b.id,
          rowId: it.id,
          trackingCode: `${b.trackingCode} (ردیف ${idx + 1})`,
          parentBatchTitle: b.title,
          parentBatchCode: b.trackingCode,
          typeLabel: b.batchType === 'ADVANCE' ? 'ردیف مساعده گروهی' : 'ردیف پرداخت گروهی',
          payeeName: it.payeeName,
          requesterId: b.requesterId,
          requesterName: b.requesterName,
          department: b.department,
          company: b.company,
          supervisorId: currentSupervisorId(b,it),
          supervisorName: currentSupervisorName(b,it),
          amount: it.amount,
          initialAmount: it.initialAmount ?? it.amount,
          approvedAmount: it.approvedAmount ?? it.amount,
          destinationBank: it.bankName,
          accountOrCard: it.accountOrCard,
          iban: it.iban,
          description: it.description,
          invoiceNumber: it.invoiceNumber,
          costCenter:it.costCenter,
          status: itemStatus,
          reviewRejection: it.reviewRejection,
          version: ver,
          isResubmitted: isResub,
          resubmittedAt: it.resubmittedAt || null,
          attachments: it.attachments || b.attachments || [],
          comments: it.comments || [],
          auditHistory: audit,
          returnedReason: it.returnedReason || null,
          returnedById: effReturnedById || null,
          returnedByRole: it.returnedByRole || null,
          returnedByName: it.returnedByName || null,
          returnedAt: it.returnedAt || null,
          approverId: effApproverId,
          approverName: effApproverName,
          approverDecidedAt: effApproverAt || null,
          approverApprovedVersion: it.approverApprovedVersion || null,
          approverNote: it.approverNote || b.approverNote,
          accountingId: effAccountingId || null,
          accountingName: effAccountingName || null,
          accountingDecidedAt: effAccountingAt || null,
          accountingApprovedVersion: it.accountingApprovedVersion || null,
          accountingNote: it.accountingNote || b.accountingNote,
          paidBankName: it.paidBankName || b.paidBankName,
          paidDateJalali: it.paidDateJalali || b.paidDateJalali,
          myApprovedDecision: decisionInfo.myApprovedDecision,
          myReturnedDecision: decisionInfo.myReturnedDecision,
          myLastActionAt: decisionInfo.myLastActionAt,
          myLastActionSummary: decisionInfo.myLastActionSummary,
          myLastNoteOrReason: decisionInfo.myLastNoteOrReason,
          ...stageInfo,
        });
      });
    }

    // 2. Single Payments
    for (const p of paymentRequests) {
      const ver = p.version || 1;
      const audit = p.auditHistory || [];
      const isResub =
        Boolean(p.isResubmitted) ||
        (ver > 1 && audit.some((a) => a.decision === 'RESUBMIT' || a.action.includes('ارسال مجدد')));

      const effApproverId = p.approvedBySupervisorUserId || p.supervisorId;
      const effApproverName = p.approvedBySupervisorName || p.supervisorName;
      const effApproverAt = p.approvedBySupervisorAt || p.approverDecidedAt;
      const effAccountingId = p.approvedByAccountingUserId || p.accountingId;
      const effAccountingName = p.approvedByAccountingName || p.accountingName;
      const effAccountingAt = p.approvedByAccountingAt || p.accountingDecidedAt;
      const effReturnedById = p.returnedByUserId || p.returnedById;

      const stageInfo = computeStageInfo({
        status: p.status,
        reviewRejection: p.reviewRejection,
        hasSupervisorStage: Boolean(p.supervisorId || p.approvedBySupervisorUserId),
        supervisorName: currentSupervisorName(p)||effApproverName,
        approverNote: p.approverNote,
        accountingName: effAccountingName,
        accountingNote: p.accountingNote,
        paidBankName: p.paidBankName,
        returnedByRole: p.returnedByRole,
        returnedReason: p.returnedReason,
        requesterName: p.requesterName,
      });

      const decisionInfo = extractMyDecisionHistory({
        approvalChain:p.approvalChain,
        status: p.status,
        version: ver,
        auditHistory: audit,
        supervisorId: currentSupervisorId(p),
        supervisorName: currentSupervisorName(p),
        approverId: effApproverId,
        approverName: effApproverName,
        approverDecidedAt: effApproverAt,
        approverApprovedVersion: p.approverApprovedVersion,
        approverNote: p.approverNote,
        accountingId: effAccountingId,
        accountingName: effAccountingName,
        accountingDecidedAt: effAccountingAt,
        accountingApprovedVersion: p.accountingApprovedVersion,
        accountingNote: p.accountingNote,
        returnedById: effReturnedById,
        returnedByRole: p.returnedByRole,
        returnedByName: p.returnedByName,
        returnedAt: p.returnedAt,
        returnedReason: p.returnedReason,
      });
      if (decisionInfo.myApprovedDecision && p.invalidatedPriorApproval) {
        decisionInfo.myApprovedDecision.isInvalidatedByLaterRevision = true;
      }

      list.push({
        uid: `PAYMENT:${p.id}`,
        ...requestTimeFields(p),
        itemType: 'PAYMENT',
        subKind: 'PAYMENT',
        isGroupRow: false,
        requestId: p.id,
        trackingCode: p.trackingCode,
        typeLabel: p.externalOrder?'دستور خارج سامانه':'دستور پرداخت تکی',
        payeeName: p.payeeName,
        requesterId: p.requesterId,
        requesterName: p.requesterName,
        department: p.department,
        company: p.company,
        supervisorId: currentSupervisorId(p),
        supervisorName: currentSupervisorName(p),
        amount: p.amount,
        initialAmount: p.initialAmount ?? p.amount,
        approvedAmount: p.approvedAmount ?? p.amount,
        destinationBank: p.bankName,
        accountOrCard: p.accountOrCard,
        iban: p.iban,
        description: p.externalOrder?`${p.description}\nدستوردهنده خارج سامانه: ${p.externalOrder.orderedBy}`:p.description,
        invoiceNumber: p.invoiceNumber,
        costCenter:p.costCenter,
        status: p.status,
        reviewRejection: p.reviewRejection,
        version: ver,
        isResubmitted: isResub,
        resubmittedAt: p.resubmittedAt || null,
        attachments: p.attachments || [],
        comments: p.comments || [],
        auditHistory: audit,
        returnedReason: p.returnedReason || null,
        returnedById: effReturnedById || null,
        returnedByRole: p.returnedByRole || null,
        returnedByName: p.returnedByName || null,
        returnedAt: p.returnedAt || null,
        approverId: effApproverId,
        approverName: effApproverName,
        approverDecidedAt: effApproverAt || null,
        approverApprovedVersion: p.approverApprovedVersion || null,
        approverNote: p.approverNote,
        accountingId: effAccountingId,
        accountingName: effAccountingName,
        accountingDecidedAt: effAccountingAt || null,
        accountingApprovedVersion: p.accountingApprovedVersion || null,
        accountingNote: p.accountingNote,
        paidBankName: p.paidBankName,
        paidDateJalali: p.paidDateJalali,
        myApprovedDecision: decisionInfo.myApprovedDecision,
        myReturnedDecision: decisionInfo.myReturnedDecision,
        myLastActionAt: decisionInfo.myLastActionAt,
        myLastActionSummary: decisionInfo.myLastActionSummary,
        myLastNoteOrReason: decisionInfo.myLastNoteOrReason,
        ...stageInfo,
      });
    }

    // 3. Single Advances
    for (const a of advanceRequests) {
      const ver = a.version || 1;
      const audit = a.auditHistory || [];
      const isResub =
        Boolean(a.isResubmitted) ||
        (ver > 1 && audit.some((e) => e.decision === 'RESUBMIT' || e.action.includes('ارسال مجدد')));

      const effApproverId = a.approvedBySupervisorUserId || a.supervisorId;
      const effApproverName = a.approvedBySupervisorName || a.supervisorName;
      const effApproverAt = a.approvedBySupervisorAt || a.approverDecidedAt;
      const effAccountingId = a.approvedByAccountingUserId || a.accountingId;
      const effAccountingName = a.approvedByAccountingName || a.accountingName;
      const effAccountingAt = a.approvedByAccountingAt || a.accountingDecidedAt;
      const effReturnedById = a.returnedByUserId || a.returnedById;

      const stageInfo = computeStageInfo({
        status: a.status,
        reviewRejection: a.reviewRejection,
        hasSupervisorStage: Boolean(a.supervisorId || a.approvedBySupervisorUserId),
        supervisorName: currentSupervisorName(a)||effApproverName,
        approverNote: a.approverNote,
        accountingName: effAccountingName,
        accountingNote: a.accountingNote,
        paidBankName: a.paidBankName,
        returnedByRole: a.returnedByRole,
        returnedReason: a.returnedReason,
        requesterName: a.requesterName,
      });

      const decisionInfo = extractMyDecisionHistory({
        approvalChain:a.approvalChain,
        status: a.status,
        version: ver,
        auditHistory: audit,
        supervisorId: currentSupervisorId(a),
        supervisorName: currentSupervisorName(a),
        approverId: effApproverId,
        approverName: effApproverName,
        approverDecidedAt: effApproverAt,
        approverApprovedVersion: a.approverApprovedVersion,
        approverNote: a.approverNote,
        accountingId: effAccountingId,
        accountingName: effAccountingName,
        accountingDecidedAt: effAccountingAt,
        accountingApprovedVersion: a.accountingApprovedVersion,
        accountingNote: a.accountingNote,
        returnedById: effReturnedById,
        returnedByRole: a.returnedByRole,
        returnedByName: a.returnedByName,
        returnedAt: a.returnedAt,
        returnedReason: a.returnedReason,
      });
      if (decisionInfo.myApprovedDecision && a.invalidatedPriorApproval) {
        decisionInfo.myApprovedDecision.isInvalidatedByLaterRevision = true;
      }

      list.push({
        uid: `ADVANCE:${a.id}`,
        ...requestTimeFields(a),
        itemType: 'ADVANCE',
        subKind: 'ADVANCE',
        isGroupRow: false,
        requestId: a.id,
        trackingCode: a.trackingCode,
        typeLabel: 'مساعده حقوق تکی',
        payeeName: a.requesterName,
        requesterId: a.requesterId,
        requesterName: a.requesterName,
        department: a.department,
        company: a.company,
        supervisorId: currentSupervisorId(a),
        supervisorName: currentSupervisorName(a),
        amount: a.amount,
        initialAmount: a.initialAmount ?? a.amount,
        approvedAmount: a.approvedAmount ?? a.amount,
        destinationBank: 'حساب حقوق',
        accountOrCard: '',
        iban: '',
        description: `مساعده ${a.requestedMonth} — ${a.reason}`,
        status: a.status,
        version: ver,
        isResubmitted: isResub,
        reviewRejection: a.reviewRejection,
        resubmittedAt: a.resubmittedAt || null,
        attachments: a.attachments || [],
        comments: a.comments || [],
        auditHistory: audit,
        returnedReason: a.returnedReason || null,
        returnedById: effReturnedById || null,
        returnedByRole: a.returnedByRole || null,
        returnedByName: a.returnedByName || null,
        returnedAt: a.returnedAt || null,
        approverId: effApproverId,
        approverName: effApproverName,
        approverDecidedAt: effApproverAt || null,
        approverApprovedVersion: a.approverApprovedVersion || null,
        approverNote: a.approverNote,
        accountingId: effAccountingId,
        accountingName: effAccountingName,
        accountingDecidedAt: effAccountingAt || null,
        accountingApprovedVersion: a.accountingApprovedVersion || null,
        accountingNote: a.accountingNote,
        paidBankName: a.paidBankName,
        paidDateJalali: a.paidDateJalali,
        myApprovedDecision: decisionInfo.myApprovedDecision,
        myReturnedDecision: decisionInfo.myReturnedDecision,
        myLastActionAt: decisionInfo.myLastActionAt,
        myLastActionSummary: decisionInfo.myLastActionSummary,
        myLastNoteOrReason: decisionInfo.myLastNoteOrReason,
        ...stageInfo,
      });
    }

    return list;
  }, [batchPayments, paymentRequests, advanceRequests, currentUser, mode]);

  // Separate into the 4 independent status categories with real counters
  const pendingRows = useMemo(
    () =>
      allUnifiedRows.filter(
        (r) => r.status === targetPendingStatus && isWithinReviewerScope(r)
      ),
    [allUnifiedRows, targetPendingStatus, currentUser, mode]
  );

  const approvedByMeRows = useMemo(
    () => allUnifiedRows.filter((r) => Boolean(r.myApprovedDecision)),
    [allUnifiedRows]
  );

  const returnedByMeRows = useMemo(
    () =>
      allUnifiedRows.filter(
        (r) =>
          r.status === 'Needs_Revision' &&
          Boolean(r.myReturnedDecision && r.myReturnedDecision.isCurrentlyWaitingRevision)
      ),
    [allUnifiedRows]
  );

  const rejectedByMeRows = useMemo(() => allUnifiedRows.filter(r =>
    ['Rejected','Closed'].includes(r.status) && r.reviewRejection?.byUserId === currentUser.id && r.reviewRejection.stage === mode
  ), [allUnifiedRows,currentUser.id,mode]);

  const allMyRecordsRows = useMemo(
    () =>
      allUnifiedRows.filter(
        (r) =>
          Boolean(r.myApprovedDecision) ||
          Boolean(r.myReturnedDecision) ||
          (r.reviewRejection?.byUserId === currentUser.id && r.reviewRejection.stage === mode) ||
          Boolean(r.myLastActionSummary)
      ),
    [allUnifiedRows,currentUser.id,mode]
  );

  const activeCategoryRows = useMemo(() => {
    switch (categoryTab) {
      case 'PENDING':
        return pendingRows;
      case 'APPROVED_BY_ME':
        return approvedByMeRows;
      case 'RETURNED_BY_ME':
        return returnedByMeRows;
      case 'REJECTED_BY_ME':
        return rejectedByMeRows;
      case 'ALL_MY_RECORDS':
        return allMyRecordsRows;
    }
  }, [categoryTab, pendingRows, approvedByMeRows, returnedByMeRows, rejectedByMeRows, allMyRecordsRows]);

  // Filtering within active category tab
  const normalizedQuery = normalizePersianText(searchQuery);

  const filteredRows = useMemo(() => {
    return activeCategoryRows.filter((r) => {
      if (typeFilter === 'BATCH_ITEMS' && !r.isGroupRow) return false;
      if (typeFilter === 'SINGLE_ONLY' && r.isGroupRow) return false;
      if (typeFilter === 'PAYMENTS' && r.subKind !== 'PAYMENT') return false;
      if (typeFilter === 'ADVANCES' && r.subKind !== 'ADVANCE') return false;

      if (!normalizedQuery) return true;
      return (
        normalizePersianText(r.trackingCode).includes(normalizedQuery) ||
        normalizePersianText(r.payeeName).includes(normalizedQuery) ||
        normalizePersianText(r.requesterName).includes(normalizedQuery) ||
        normalizePersianText(r.description).includes(normalizedQuery) ||
        normalizePersianText(r.destinationBank).includes(normalizedQuery) ||
        String(r.amount).includes(normalizedQuery) ||
        (r.parentBatchTitle && normalizePersianText(r.parentBatchTitle).includes(normalizedQuery))
      );
    });
  }, [activeCategoryRows, typeFilter, normalizedQuery]);

  const { sortedItems: sortedRows, sortConfig, handleSort } =
    useSortableTable<ApproverPendingRow>(filteredRows.map(r=>({...r,...requestRecordSortFields(requestDetails.resolve({kind:r.itemType,id:r.requestId,rowId:r.rowId}))})), 'amount', 'numeric', 'desc');

  // Multi-select calculations (only for PENDING tab)
  const selectedRows = useMemo(() => {
    return sortedRows.filter((r) => selectedUids.includes(r.uid));
  }, [sortedRows, selectedUids]);

  const selectedTotalSum = selectedRows.reduce(
    (sum, r) => sum + (r.approvedAmount ?? r.amount),
    0
  );

  const handleToggleSelectAll = () => {
    if (selectedUids.length === sortedRows.length && sortedRows.length > 0) {
      setSelectedUids([]);
    } else {
      setSelectedUids(sortedRows.map((r) => r.uid));
    }
  };

  const handleToggleSelectRow = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // Row Action Handlers
  const handleQuickApproveRow = async (row: ApproverPendingRow) => {
    setProcessingUid(row.uid);
    try {
      const ok = await onRowReviewAction({
        reviewerId: currentUser.id,
        reviewStage: mode,
        expectedVersion: row.version,
        expectedStatus: row.status,
        itemType: row.itemType,
        requestId: row.requestId,
        rowId: row.rowId,
        action: 'APPROVE',
        comment:
          mode === 'APPROVER'
            ? 'تایید ردیف توسط سرپرست'
            : 'تایید مالی ردیف توسط حسابداری',
      });
      if (ok) {
        setSelectedUids((prev) => prev.filter((id) => id !== row.uid));
      }
    } finally {
      setProcessingUid(null);
    }
  };

  // Open Return Modal for Single or Multiple Rows
  const handleOpenReturnModal = (rows: ApproverPendingRow[], action:typeof reasonAction = 'RETURN_FOR_REVISION') => {
    setReasonAction(action);
    setReturnTargetRows(rows);
    setReturnReasonText('');
  };

  const handleConfirmReturnForRevision = async () => {
    if (!returnTargetRows || returnTargetRows.length === 0) return;
    if (!returnReasonText.trim()) {
      return;
    }

    setIsReturning(true);
    try {
      if (returnTargetRows.length === 1) {
        const row = returnTargetRows[0];
        const ok = await onRowReviewAction({
          reviewerId: currentUser.id,
          reviewStage: mode,
          expectedVersion: row.version,
          expectedStatus: row.status,
          itemType: row.itemType,
          requestId: row.requestId,
          rowId: row.rowId,
          action: reasonAction,
          returnReason: returnReasonText.trim(),
        });
        if (ok) {
          setSelectedUids((prev) => prev.filter((id) => id !== row.uid));
          setReturnTargetRows(null);
        }
      } else {
        const result = await onBulkReviewAction({
          reviewerId: currentUser.id,
          reviewStage: mode,
          action: reasonAction === 'REJECT' ? 'REJECT' : 'RETURN_FOR_REVISION',
          returnReason: returnReasonText.trim(),
          items: returnTargetRows.map((r) => ({
            itemType: r.itemType,
            requestId: r.requestId,
            rowId: r.rowId,
            expectedVersion: r.version,
            expectedStatus: r.status,
          })),
        });
        if (typeof result === 'object' && result !== null) {
          const succeeded = new Set(result.succeededUids || []);
          setSelectedUids((prev) => prev.filter((uid) => !succeeded.has(uid)));
          if ((result.failedCount || 0) > 0) {
            setBulkResultFeedback({
              successCount: result.successCount || 0,
              failedCount: result.failedCount || 0,
              failures: result.failures || [],
            });
          }
        } else if (result === true) {
          setSelectedUids([]);
        }
        if(result !== false && (typeof result !== 'object' || result.success))setReturnTargetRows(null);
      }
    } finally {
      setIsReturning(false);
    }
  };

  // Bulk Approve Handler (only removes rows that actually succeeded!)
  const handleBulkApprove = async () => {
    if (selectedRows.length === 0) return;
    setBulkProcessing(true);
    setBulkResultFeedback(null);
    try {
      const result = await onBulkReviewAction({
        reviewerId: currentUser.id,
        reviewStage: mode,
        action: 'APPROVE',
        items: selectedRows.map((r) => ({
          itemType: r.itemType,
          requestId: r.requestId,
          rowId: r.rowId,
          expectedVersion: r.version,
          expectedStatus: r.status,
        })),
      });
      if (typeof result === 'object' && result !== null) {
        const succeeded = new Set(result.succeededUids || []);
        if (succeeded.size > 0) {
          setSelectedUids((prev) => prev.filter((uid) => !succeeded.has(uid)));
        } else if ((result.failedCount || 0) === 0 && result.success) {
          setSelectedUids([]);
        }
        if ((result.failedCount || 0) > 0) {
          setBulkResultFeedback({
            successCount: result.successCount || 0,
            failedCount: result.failedCount || 0,
            failures: result.failures || [],
          });
        }
      } else if (result === true) {
        setSelectedUids([]);
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  // Open Edit Amount & Comment Modal
  const handleOpenEditModal = (row: ApproverPendingRow) => {
    setEditingRow(row);
    setEditAmountVal(String(row.approvedAmount ?? row.amount));
    setEditAmountReason('');
    setEditCommentText('');
    setEditError('');
    setEditCostCenterId('');
  };

  const handleSaveEditRow = async (andApprove: boolean) => {
    if (!editingRow) return;
    if(editAmountInput.current&&!editAmountInput.current.reportValidity())return;
    const error=reviewEditError('UPDATE_AMOUNT_COMMENT',Number(editAmountVal),editAmountReason,editCommentText);
    if(error){setEditError(error);return;}
    setIsSavingEdit(true);
    try {
      const numVal = Number(editAmountVal);
      const ok = await onRowReviewAction({
        reviewerId: currentUser.id,
        reviewStage: mode,
        expectedVersion: editingRow.version,
        expectedStatus: editingRow.status,
        itemType: editingRow.itemType,
        requestId: editingRow.requestId,
        rowId: editingRow.rowId,
        action: andApprove ? 'UPDATE_AND_APPROVE' : 'UPDATE_AMOUNT_COMMENT',
        newAmount: numVal,
        amountChangeReason: editAmountReason,
        ...(editCostCenterId?{newCostCenterId:editCostCenterId}:{}),
        comment: editCommentText,
      });
      if (ok) {
        setEditingRow(null);
        setSelectedUids((prev) => prev.filter((id) => id !== editingRow.uid));
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const activeCategoryMeta = useMemo(() => {
    switch (categoryTab) {
      case 'PENDING':
        return {
          title: 'در انتظار تأیید من (صف اقدام فعلی)',
          count: pendingRows.length,
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
        };
      case 'APPROVED_BY_ME':
        return {
          title: 'تأییدشده توسط من (سابقه تأییدها)',
          count: approvedByMeRows.length,
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        };
      case 'RETURNED_BY_ME':
        return {
          title: 'برگشت‌داده‌شده برای اصلاح',
          count: returnedByMeRows.length,
          badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
        };
      case 'ALL_MY_RECORDS':
        return {
          title: 'همه سوابق و تصمیمات من',
          count: allMyRecordsRows.length,
          badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
        };
      case 'REJECTED_BY_ME':
        return {title:'ردشده توسط من',count:rejectedByMeRows.length,badgeClass:'bg-rose-100 text-rose-900 border-rose-200'};
    }
  }, [categoryTab, pendingRows.length, approvedByMeRows.length, returnedByMeRows.length, rejectedByMeRows.length, allMyRecordsRows.length]);

  return (
    <div className="space-y-5">
      {/* 1. Header and Filters (Category selection is controlled via the right sidebar menu) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'APPROVER'
                  ? `کارتابل تأیید سرپرست واحد: ${activeCategoryMeta.title}`
                  : `کارتابل بررسی مالی حسابداری: ${activeCategoryMeta.title}`}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono-num font-bold border ${activeCategoryMeta.badgeClass}`}
              >
                {activeCategoryMeta.count.toLocaleString('fa-IR')} ردیف
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              بررسی‌کننده: {currentUser.name} · تغییر بخش کارتابل از منوی کشویی سمت راست
            </p>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس نام پرسنل، گیرنده وجه، بابت، کد یا مبلغ..."
              className="w-full pr-10 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>
        </div>

        {/* Request Type & Single/Group Mode Filters (Works inside every status category) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 ml-1">فیلتر نوع و حالت:</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              همه موارد این بخش ({activeCategoryRows.length.toLocaleString('fa-IR')})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('PAYMENTS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                typeFilter === 'PAYMENTS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              دستور پرداخت‌ها (تکی و گروهی) (
              {activeCategoryRows.filter((r) => r.subKind === 'PAYMENT').length.toLocaleString('fa-IR')}
              )
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('ADVANCES')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                typeFilter === 'ADVANCES'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              مساعده‌های حقوق (تکی و گروهی) (
              {activeCategoryRows.filter((r) => r.subKind === 'ADVANCE').length.toLocaleString('fa-IR')}
              )
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SINGLE_ONLY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                typeFilter === 'SINGLE_ONLY'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              فقط درخواست‌های تکی (
              {activeCategoryRows.filter((r) => !r.isGroupRow).length.toLocaleString('fa-IR')})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('BATCH_ITEMS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                typeFilter === 'BATCH_ITEMS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              فقط ردیف‌های گروهی / تجمیعی (
              {activeCategoryRows.filter((r) => r.isGroupRow).length.toLocaleString('fa-IR')})
            </button>
          </div>
        </div>
      </section>

      {/* Bulk Partial Failure / Result Alert Banner */}
      {bulkResultFeedback && (
        <section className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-amber-950 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>
                نتیجه عملیات گروهی: {bulkResultFeedback.successCount.toLocaleString('fa-IR')} ردیف با موفقیت انجام شد و از صف خارج گردید؛{' '}
                {bulkResultFeedback.failedCount.toLocaleString('fa-IR')} ردیف ناموفق در صف باقی ماند.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setBulkResultFeedback(null)}
              className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {bulkResultFeedback.failures.length > 0 && (
            <ul className="list-disc list-inside text-amber-900 space-y-1 pr-2">
              {bulkResultFeedback.failures.map((f, idx) => (
                <li key={idx}>
                  ردیف <span className="font-mono-num font-bold">{f.id}</span>: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 2. Bulk Action Bar (Only in PENDING tab when rows are selected) */}
      {mode==='APPROVER'&&categoryTab==='PENDING'&&selectedRows.length>0&&<div className="flex justify-end"><AccountInquiryRequestButton company={selectedRows[0].company} targets={selectedRows.map(row=>({itemType:row.itemType,requestId:row.requestId,rowId:row.rowId,expectedVersion:row.version||1,expectedStatus:row.status}))}/></div>}
      {categoryTab === 'PENDING' && selectedUids.length > 0 && (
        <section className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 font-bold">
              تعداد انتخاب‌شده:{' '}
              <strong className="font-mono-num text-amber-400">{selectedRows.length}</strong> ردیف
            </span>
            <span className="text-xs font-bold">
              مجموع مبالغ انتخابی:{' '}
              <strong className="font-mono-num text-emerald-400 text-sm">
                {formatRial(selectedTotalSum)} ریال
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkProcessing}
              onClick={handleBulkApprove}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تأیید موارد انتخاب‌شده ({selectedRows.length})</span>
            </button>

            <button
              type="button"
              disabled={bulkProcessing}
              onClick={() => handleOpenReturnModal(selectedRows)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>برگشت برای اصلاح ({selectedRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedUids([])}
              className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              لغو انتخاب
            </button>
            <button type="button" disabled={bulkProcessing || !canReject} onClick={() => handleOpenReturnModal(selectedRows,'REJECT')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer disabled:opacity-50">
              <X className="w-3.5 h-3.5" />رد درخواست ({selectedRows.length})
            </button>
          </div>
        </section>
      )}

      {/* 3. Rows Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            {categoryTab === 'PENDING' &&
              `صف بررسی ردیف‌های در انتظار تأیید من (${sortedRows.length.toLocaleString('fa-IR')} ردیف)`}
            {categoryTab === 'APPROVED_BY_ME' &&
              `فهرست ردیف‌های تأییدشده توسط من (${sortedRows.length.toLocaleString('fa-IR')} ردیف)`}
            {categoryTab === 'RETURNED_BY_ME' &&
              `ردیف‌های برگشت‌داده‌شده برای اصلاح که منتظر اقدام متقاضی هستند (${sortedRows.length.toLocaleString('fa-IR')} ردیف)`}
            {categoryTab === 'ALL_MY_RECORDS' &&
              `همه سوابق تصمیمات من به همراه وضعیت فعلی و تاریخچه (${sortedRows.length.toLocaleString('fa-IR')} ردیف)`}
            {categoryTab === 'REJECTED_BY_ME' && `ردشده توسط من (${sortedRows.length.toLocaleString('fa-IR')} ردیف)`}
          </h3>
          <span className="text-xs text-slate-500">
            {categoryTab === 'PENDING'
              ? 'هر ردیف گروه مستقل شمارش و بررسی می‌شود؛ موارد اصلاح‌شده با برچسب «ارسال مجدد» مشخص شده‌اند.'
              : categoryTab === 'REJECTED_BY_ME' ? 'موارد باز فقط توسط شما قابل تأیید یا بستن نهایی هستند؛ موارد بسته‌شده بایگانی می‌مانند.' : 'این بخش سابقه تصمیمات شماست و امکان تأیید مجدد یا تکراری از روی سوابق وجود ندارد.'}
          </span>
        </div>

        <RequestTimeHelp/>
        <div className="w-full border border-slate-200 rounded-lg overflow-x-auto">
          <table className="request-record-table request-summary-table w-full text-right border-collapse text-xs">
<thead><RequestSummaryHeaders sortConfig={sortConfig} onSort={handleSort} selection={categoryTab==='PENDING'?<input type="checkbox" aria-label="انتخاب همه ردیف‌ها" checked={selectedUids.length===sortedRows.length&&sortedRows.length>0} onChange={handleToggleSelectAll}/>:undefined}/></thead>
            <tbody className="divide-y divide-slate-200">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={REQUEST_SUMMARY_COLUMN_COUNT+(categoryTab==='PENDING'?1:0)} className="p-8 text-center text-slate-500">
                    {categoryTab === 'PENDING' && 'هیچ موردی در صف انتظار تأیید شما وجود ندارد.'}
                    {categoryTab === 'APPROVED_BY_ME' &&
                      'هنوز هیچ ردیفی در این دسته‌بندی توسط شما تأیید نشده است.'}
                    {categoryTab === 'RETURNED_BY_ME' &&
                      'هیچ ردیف برگشت‌داده‌شده‌ای که هم‌اکنون منتظر اصلاح متقاضی باشد وجود ندارد.'}
                    {categoryTab === 'ALL_MY_RECORDS' &&
                      'هنوز سابقه‌ای از اقدامات شما برای این فیلتر ثبت نشده است.'}
                    {categoryTab === 'REJECTED_BY_ME' && 'درخواست ردشده‌ای توسط شما در این مرحله وجود ندارد.'}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const isChecked = selectedUids.includes(row.uid);
                  const isBusy = processingUid === row.uid;
                  const hasEditedAmount =
                    row.approvedAmount && row.approvedAmount !== row.initialAmount;

                  return (
                    <RequestSummaryRow key={row.uid} target={{kind:row.itemType,id:row.requestId,rowId:row.rowId}} index={idx+1} selection={categoryTab==='PENDING'?<input type="checkbox" aria-label="انتخاب ردیف" checked={isChecked} onChange={()=>handleToggleSelectRow(row.uid)}/>:undefined} className={isChecked?'bg-sky-50/70':''}>
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {mode==='APPROVER'&&<AccountInquiryRequestButton company={row.company} disabled={isBusy} allowCreate={categoryTab==='PENDING'} targets={[{itemType:row.itemType,requestId:row.requestId,rowId:row.rowId,expectedVersion:row.version||1,expectedStatus:row.status}]}/>}
                          {categoryTab === 'PENDING' && (
                            <>

                              {/* Quick Approve */}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickApproveRow(row)}
                                title="تایید و ارسال به مرحله بعد"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>تأیید</span>
                              </button>

                              {/* Edit Amount & Comment */}
                              <button
                                type="button"
                                disabled={isBusy || !canEdit}
                                onClick={() => handleOpenEditModal(row)}
                                title="ویرایش مبلغ و ثبت یادداشت"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer disabled:opacity-50"
                              >
                                <Edit className="w-3 h-3 text-slate-600" />
                                <span>ویرایش</span>
                              </button>

                              {/* Return for Revision */}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleOpenReturnModal([row])}
                                title="برگشت برای اصلاح با ذکر علت اجباری"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                <span>برگشت</span>
                              </button>
                              <button type="button" disabled={isBusy || !canReject} onClick={()=>handleOpenReturnModal([row],'REJECT')}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer disabled:opacity-50">
                                <X className="w-3 h-3" />رد درخواست
                              </button>
                            </>
                          )}
                          {categoryTab === 'REJECTED_BY_ME' && ownsOpenRejection(row,currentUser.id,mode) && <>
                            <button type="button" disabled={isBusy || !canApprove} onClick={()=>handleQuickApproveRow(row)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded cursor-pointer disabled:opacity-50"><Check className="w-3.5 h-3.5" />تأیید و ارسال به مرحله بعد</button>
                            <button type="button" disabled={isBusy || !canReject} onClick={()=>handleOpenReturnModal([row],'CLOSE_REJECTED')} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer disabled:opacity-50"><X className="w-3 h-3" />بستن نهایی درخواست</button>
                          </>}

                          {/* View Full Row History Button */}
                          <button
                            type="button"
                            onClick={() => requestDetails.open({kind:row.itemType,id:row.requestId,rowId:row.rowId})}
                            title="مشاهده تاریخچه کامل تصمیمات و نسخه‌های این ردیف"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded cursor-pointer"
                          >
                            <History className="w-3 h-3" />
                            <span>تاریخچه</span>
                          </button>
                        </div>
                      </RequestSummaryRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Modal: Edit Amount & Comment */}
      {editingRow && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="ویرایش مبلغ و ثبت یادداشت رسمی"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  ویرایش مبلغ، مرکز هزینه و یادداشت رسمی
                </h3>
                <p className="text-xs text-slate-500">
                  {editingRow.trackingCode} — {editingRow.payeeName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError&&<p role="alert" className="text-xs text-rose-800">{editError}</p>}
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">مبلغ اولیه درخواستی:</span>{' '}
                  <strong className="font-mono-num text-slate-900 font-bold">
                    {formatRial(editingRow.initialAmount)} ریال
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">درخواست‌کننده:</span>{' '}
                  {editingRow.requesterName} ({editingRow.department})
                </div>
                <div>
                  <span className="text-slate-500">شرح ردیف:</span> {editingRow.description}
                </div>
                <div><span className="text-slate-500">مرکز هزینهٔ ثبت‌شده:</span> <strong>{editingRecord?.costCenter||'برای این فرم ثبت نشده'}</strong></div>
              </div>

              {editingRow.itemType!=='ADVANCE'&&<label className="block text-xs font-semibold text-slate-700 space-y-1">مرکز هزینه
                <CostCenterSelect aria-label="مرکز هزینه" disabled={isSavingEdit||!canEdit} value={editCostCenterId} onChange={e=>setEditCostCenterId(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"><option value="">بدون تغییر — {editingRecord?.costCenter||'ثبت نشده'}</option>{editingCenters.map(c=><option key={c.id} value={c.id}>{c.name}{c.code?' — '+c.code:''}</option>)}</CostCenterSelect>
                <span className="block font-normal text-slate-500">فقط مراکز فعال شرکت همین درخواست؛ تغییر با دلیل در سابقهٔ رسمی ثبت می‌شود.</span>
              </label>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مبلغ مصوب جدید (ریال):
                </label>
                <RialInput ref={editAmountInput}
                  min={1000}
                  aria-label="مبلغ مصوب جدید (ریال)"
                  disabled={isSavingEdit}
                  value={editAmountVal}
                  onChange={(e) => setEditAmountVal(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:bg-slate-50"
                />
                <span className="text-[11px] text-slate-500 font-mono-num mt-1 block">
                  معادل: <strong>{formatRial(Number(editAmountVal) || 0)} ریال</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  دلیل ویرایش مبلغ یا مرکز هزینه (الزامی):
                </label>
                <input
                  type="text"
                  value={editAmountReason}
                  aria-label="دلیل تغییر مبلغ"
                  required
                  maxLength={2000}
                  disabled={isSavingEdit}
                  onChange={(e) => setEditAmountReason(e.target.value)}
                  placeholder="مثال: تعدیل طبق آیین‌نامه ماموریت یا کسر کسورات..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  کامنت و یادداشت رسمی (قابل مشاهده از متقاضی تا خزانه):
                </label>
                <textarea
                  rows={2}
                  value={editCommentText}
                  aria-label="کامنت و یادداشت رسمی"
                  maxLength={4000}
                  disabled={isSavingEdit}
                  onChange={(e) => setEditCommentText(e.target.value)}
                  placeholder="توضیح تاییدکننده..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingEdit || !canEdit || !editAmountReason.trim()}
                  onClick={() => handleSaveEditRow(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>فقط ذخیره تغییرات</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingEdit || !canEdit || !editAmountReason.trim()}
                  onClick={() => handleSaveEditRow(true)}
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ذخیره و تأیید نهایی ردیف</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Return for Revision */}
      {returnTargetRows && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-reason-title"
          id="review-reason-dialog"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-5 h-5" />
                <h3 id="review-reason-title" className="font-bold text-slate-900 text-sm">
                  {reasonTitle} ({returnTargetRows.length} مورد)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReturnTargetRows(null)}
                disabled={isReturning}
                aria-label="بستن پنجره"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                {reasonAction === 'REJECT' ? 'درخواست حذف نمی‌شود؛ در «ردشده توسط من» باز می‌ماند. فقط شما با مجوز جاری می‌توانید آن را تأیید یا نهایی ببندید. این کار برگشت برای اصلاح نیست.' : reasonAction === 'CLOSE_REJECTED' ? 'درخواست به صورت نهایی بسته و بایگانی می‌شود و دیگر قابل تأیید، اصلاح یا پرداخت نیست. این کار حذف اطلاعات نیست.' : 'ردیف‌ها به «نیازمند اصلاح» در کارتابل درخواست‌کننده منتقل می‌شوند تا پس از اصلاح، با نسخه جدید به صف تأیید برگردند.'}
              </p>

              <div>
                <label htmlFor="review-reason" className="block text-xs font-semibold text-rose-900 mb-1">
                  علت {reasonTitle} (الزامی):
                </label>
                <textarea
                  required
                  id="review-reason"
                  maxLength={4000}
                  disabled={isReturning}
                  rows={3}
                  value={returnReasonText}
                  onChange={(e) => setReturnReasonText(e.target.value)}
                  placeholder="دلیل عدم تایید یا موارد نیازمند اصلاح را به روشنی بنویسید..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReturnTargetRows(null)}
                disabled={isReturning}
                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isReturning || !returnReasonText.trim()}
                onClick={handleConfirmReturnForRevision}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{isReturning ? 'در حال ثبت…' : reasonAction === 'RETURN_FOR_REVISION' ? 'ثبت برگشت جهت اصلاح' : `ثبت ${reasonTitle}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Attachment Preview */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-600" />
                <span>مشاهده مدرک پیوست: {previewAttachment.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
              {previewAttachment.type.startsWith('image/') ||
              previewAttachment.url.startsWith('data:image/') ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-h-80 w-auto object-contain rounded"
                />
              ) : (
                <div className="p-6 text-center text-xs text-slate-600">
                  <span className="font-bold block text-sm mb-1">{previewAttachment.name}</span>
                  <span>فایل سندی / فاکتور الکترونیک</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono-num">
                حجم: {(previewAttachment.size / 1024).toFixed(1)} KB
              </span>
              <a
                href={previewAttachment.url}
                download={previewAttachment.name}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود فایل</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
