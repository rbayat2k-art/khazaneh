import React, { useState, useEffect, useRef } from 'react';
import {OfficialReviewNotes} from './OfficialReviewNotes';
import {cardInputProps,ibanInputProps} from './bank-input';
import {bankFieldsError} from '../utils/bank-identifiers';
import { rejectionDescription } from '../utils/review-rejection';
import {
  Search,
  Plus,
  FileText,
  Eye,
  X,
  ListPlus,
  Trash2,
  Paperclip,
  Upload,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  MessageSquare,
  Clock,
  Download,
  Edit,
} from 'lucide-react';
import type {
  AdvanceRequest,
  PaymentRequest,
  BatchPaymentRequest,
  ReceiptArchive,
  User,
  Priority,
  BatchItem,
  AttachmentFile,
  CostCenterItem,
} from '../types/treasury';
import { SYSTEM_BANKS, normalizeRolePermissionSet } from '../types/treasury';
import { canEditSubmittedRequest, type EditableRequestRow, type SubmittedEditKind, type SubmittedRequestEdit } from '../utils/request-edit';
import { SubmittedRequestEditDialog, type SubmittedEditTarget } from './SubmittedRequestEditDialog';
import {
  useSortableTable,
  formatRial,
  getStatusLabel,
  getStatusTextClass,
  getPriorityLabel,
  normalizePersianText,
} from '../utils/sorting';
import {
  formatCardNumber,
  cleanCardNumber,
  detectBankFromCard,
  cleanIban,
} from '../utils/bankCards';
import { SortableHeader } from './SortableHeader';

interface EmployeeRequestsViewProps {
  currentUser: User;
  advanceRequests: AdvanceRequest[];
  paymentRequests: PaymentRequest[];
  batchPayments: BatchPaymentRequest[];
  receiptArchives: ReceiptArchive[];
  costCenters?: CostCenterItem[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmitAdvance: (payload: {
    requesterId: string;
    requestedMonth: string;
    amount: number;
    suggestedDate: string;
    reason: string;
    attachments?: AttachmentFile[];
  }) => Promise<boolean>;
  onSubmitPayment: (payload: {
    requesterId: string;
    dueDate: string;
    priority: Priority;
    costCenter: string;
    description: string;
    amount: number;
    payeeName: string;
    accountOrCard: string;
    iban: string;
    bankName: string;
    invoiceNumber: string;
    attachments?: AttachmentFile[];
  }) => Promise<boolean>;
  onSubmitBatchPayment: (payload: {
    requesterId: string;
    title: string;
    batchType?: 'PAYMENT' | 'ADVANCE';
    items: Omit<BatchItem, 'id'>[];
    attachments?: AttachmentFile[];
  }) => Promise<boolean>;
  onResubmitRequest: (payload: {
    requesterId: string;
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    amount?: number;
    description?: string;
    accountOrCard?: string;
    iban?: string;
    bankName?: string;
    newAttachments?: AttachmentFile[];
  }) => Promise<boolean>;
  onOpenReceiptModal: (receipt: ReceiptArchive) => void;
  onEditSubmittedRequest: (edit: SubmittedRequestEdit) => Promise<{ok:boolean;error?:string}>;
  initialFormTab?: 'PAYMENT_SINGLE' | 'PAYMENT_BATCH' | 'ADVANCE_SINGLE' | 'ADVANCE_BATCH' | 'CARTABLE';
  initialStatusFilter?: string;
}

export const EmployeeRequestsView: React.FC<EmployeeRequestsViewProps> = ({
  currentUser,
  advanceRequests,
  paymentRequests,
  batchPayments,
  receiptArchives,
  costCenters = [],
  searchInputRef,
  onSubmitAdvance,
  onSubmitPayment,
  onSubmitBatchPayment,
  onResubmitRequest,
  onEditSubmittedRequest,
  onOpenReceiptModal,
  initialFormTab = 'PAYMENT_BATCH',
  initialStatusFilter = 'ALL',
}) => {
  const activeCostCenters = React.useMemo(() => costCenters.filter(cc => cc.isActive !== false), [costCenters]);
  const todayJalali = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const datePart = (type: string) => todayJalali.find(p => p.type === type)?.value || '';
  const today = `${datePart('year')}/${datePart('month')}/${datePart('day')}`;

  // Mode controlled from right sidebar menu: PAYMENT_SINGLE | PAYMENT_BATCH | ADVANCE_SINGLE | ADVANCE_BATCH | CARTABLE
  const [activeFormTab, setActiveFormTab] = useState<'PAYMENT_SINGLE' | 'PAYMENT_BATCH' | 'ADVANCE_SINGLE' | 'ADVANCE_BATCH' | 'CARTABLE'>(initialFormTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingReads = useRef(0), uploadGeneration = useRef(0);
  const [readingFiles,setReadingFiles] = useState(false), [uploadError,setUploadError] = useState<string|null>(null);
  useEffect(() => () => { uploadGeneration.current++; }, []);

  useEffect(() => {
    if (initialFormTab) setActiveFormTab(initialFormTab);
  }, [initialFormTab]);

  useEffect(() => {
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  // File Upload Helper
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 1. Single Advance Form State
  const [advRequestedMonth, setAdvRequestedMonth] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advSuggestedDate, setAdvSuggestedDate] = useState(today);
  const [advReason, setAdvReason] = useState('');
  const [advAttachments, setAdvAttachments] = useState<AttachmentFile[]>([]);

  // 2. Single Payment Form State
  const [payDueDate, setPayDueDate] = useState(today);
  const [payPriority, setPayPriority] = useState<Priority>('Normal');
  const [payCostCenter, setCostCenter] = useState(
    () => activeCostCenters.find((c) => c.name === currentUser.department)?.name || activeCostCenters[0]?.name || currentUser.department
  );
  const [payDescription, setPayDescription] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [payAccountOrCard, setPayAccountOrCard] = useState('');
  const [payIban, setPayIban] = useState('');
  const [payBankName, setPayBankName] = useState('بانک ملت');
  const [payInvoiceNumber, setPayInvoiceNumber] = useState('');
  const [payAttachments, setPayAttachments] = useState<AttachmentFile[]>([]);

  // 3. Batch Payment Form State
  const [batchTitle, setBatchTitle] = useState('');
  const emptyBatchRow = (itemType: 'PAYMENT' | 'ADVANCE'): Omit<BatchItem, 'id'> => ({itemType,payeeName:'',amount:0,accountOrCard:'',iban:'',bankName:'بانک ملت',description:'',invoiceNumber:'',costCenter:'',attachments:[]});
  const [batchRows, setBatchRows] = useState<Array<Omit<BatchItem, 'id'>>>([emptyBatchRow('PAYMENT')]);
  const [batchGlobalAttachments, setBatchGlobalAttachments] = useState<AttachmentFile[]>([]);

  // 4. Batch Advance Form State
  const [batchAdvTitle, setBatchAdvTitle] = useState('');
  const [batchAdvRows, setBatchAdvRows] = useState<Array<Omit<BatchItem, 'id'>>>([emptyBatchRow('ADVANCE')]);

  // Resubmit Modal State
  const [resubmitTarget, setResubmitTarget] = useState<{
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    title: string;
    trackingCode: string;
    returnedReason?: string | null;
    returnedByRole?: string | null;
    returnedByName?: string | null;
    currentAmount: number;
    currentDescription: string;
    currentAccountOrCard: string;
    currentIban: string;
    currentBankName: string;
  } | null>(null);

  const [resubmitAmount, setResubmitAmount] = useState('');
  const [resubmitDescription, setResubmitDescription] = useState('');
  const [resubmitAccountOrCard, setResubmitAccountOrCard] = useState('');
  const [resubmitIban, setResubmitIban] = useState('');
  const [resubmitError,setResubmitError]=useState('');
  const [resubmitBankName, setResubmitBankName] = useState('بانک ملت');
  const [resubmitAttachments, setResubmitAttachments] = useState<AttachmentFile[]>([]);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [editSubmittedTarget,setEditSubmittedTarget]=useState<SubmittedEditTarget|null>(null);
  const permissions=normalizeRolePermissionSet(currentUser.effectivePermissions,currentUser.role);
  const mayEditSubmitted=(row:EditableRequestRow,ownerId:string,supervisorId:string|null,kind:SubmittedEditKind,batchAdvance=false)=>{
    const allowed=kind==='BATCH_ITEM' ? (batchAdvance?permissions.canSubmitBatchAdvance:permissions.canSubmitBatchPayment) : kind==='ADVANCE'?permissions.canSubmitSingleAdvance:permissions.canSubmitSinglePayment;
    return ownerId===currentUser.id&&permissions.canCreateRequest&&allowed&&canEditSubmittedRequest(row,supervisorId,ownerId);
  };

  // File Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentFile | null>(null);

  const readRequestFiles = async (files: FileList | null, apply: (files: AttachmentFile[]) => void, limit?: number) => {
    if (!files?.length || submittingRef.current) return;
    const generation = uploadGeneration.current;
    pendingReads.current++;setReadingFiles(true);setUploadError(null);
    try {
      const uploaded: AttachmentFile[] = [];
      for (const [index,file] of Array.from(files).entries()) {
        if (limit && file.size > limit) throw Error('file-too-large');
        const url = await readFileAsDataUrl(file);
        uploaded.push({id:`att-${Date.now()}-${index}`,name:file.name,size:file.size,type:file.type,url,uploadedAt:'1403/08/28',uploadedBy:currentUser.name});
      }
      if (generation === uploadGeneration.current) apply(uploaded);
    } catch {
      if (generation === uploadGeneration.current) setUploadError('خواندن مدارک کامل نشد؛ فایل را دوباره انتخاب کنید. حداکثر حجم هر مدرک ردیف گروهی۵مگابایت است.');
    } finally {
      pendingReads.current--;
      if (generation === uploadGeneration.current) setReadingFiles(pendingReads.current > 0);
    }
  };

  // Helper for batch rows
  const handleAddBatchRow = (isAdvance = false) => {
    if (isAdvance) {
      setBatchAdvRows(prev => [...prev,emptyBatchRow('ADVANCE')]);
    } else {
      setBatchRows(prev => [...prev,emptyBatchRow('PAYMENT')]);
    }
  };

  const handleRemoveBatchRow = (idx: number, isAdvance = false) => {
    if (isAdvance) {
      if (batchAdvRows.length <= 1) return;
      setBatchAdvRows((prev) => prev.filter((_, i) => i !== idx));
    } else {
      if (batchRows.length <= 1) return;
      setBatchRows((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleBatchRowFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    rowIndex: number,
    isAdvance = false
  ) => {
    const files = e.target.files;
    await readRequestFiles(files,newFiles => {
    if (isAdvance) {
      setBatchAdvRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex
            ? { ...row, attachments: [...(row.attachments || []), ...newFiles] }
            : row
        )
      );
    } else {
      setBatchRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex
            ? { ...row, attachments: [...(row.attachments || []), ...newFiles] }
            : row
        )
      );
    }
    },5 * 1024 * 1024);
  };

  // Submit Handlers
  const clearUploadInputs = (form: HTMLFormElement) => {
    form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => { input.value = ''; });
  };
  const handleSinglePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingReads.current || uploadError) return;
    const form = e.currentTarget as HTMLFormElement;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const registered = await onSubmitPayment({
        requesterId: currentUser.id,
        dueDate: payDueDate,
        priority: payPriority,
        costCenter: payCostCenter,
        description: payDescription,
        amount: Number(payAmount) || 0,
        payeeName,
        accountOrCard: payAccountOrCard,
        iban: payIban,
        bankName: payBankName,
        invoiceNumber: payInvoiceNumber,
        attachments: payAttachments,
      });
      if (!registered) return;
      uploadGeneration.current++;
      setPayAmount('');
      setPayDueDate(today);
      setPayPriority('Normal');
      setCostCenter(activeCostCenters.find(c => c.name === currentUser.department)?.name || activeCostCenters[0]?.name || currentUser.department);
      setPayBankName('بانک ملت');
      setPayInvoiceNumber('');
      setPayDescription('');
      setPayeeName('');
      setPayAccountOrCard('');
      setPayIban('');
      setPayAttachments([]);
      clearUploadInputs(form);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleBatchPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingReads.current || uploadError) return;
    const form = e.currentTarget as HTMLFormElement;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const registered = await onSubmitBatchPayment({
        requesterId: currentUser.id,
        title: batchTitle,
        batchType: 'PAYMENT',
        items: batchRows,
        attachments: batchGlobalAttachments,
      });
      if (!registered) return;
      uploadGeneration.current++;
      setBatchTitle('');
      setBatchRows([emptyBatchRow('PAYMENT')]);
      setBatchGlobalAttachments([]);
      clearUploadInputs(form);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSingleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingReads.current || uploadError) return;
    const form = e.currentTarget as HTMLFormElement;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const registered = await onSubmitAdvance({
        requesterId: currentUser.id,
        requestedMonth: advRequestedMonth,
        amount: Number(advAmount) || 0,
        suggestedDate: advSuggestedDate,
        reason: advReason,
        attachments: advAttachments,
      });
      if (!registered) return;
      uploadGeneration.current++;
      setAdvRequestedMonth('');
      setAdvAmount('');
      setAdvSuggestedDate(today);
      setAdvReason('');
      setAdvAttachments([]);
      clearUploadInputs(form);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleBatchAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || pendingReads.current || uploadError) return;
    const form = e.currentTarget as HTMLFormElement;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const registered = await onSubmitBatchPayment({
        requesterId: currentUser.id,
        title: batchAdvTitle,
        batchType: 'ADVANCE',
        items: batchAdvRows,
        attachments: [],
      });
      if (!registered) return;
      uploadGeneration.current++;
      setBatchAdvTitle('');
      setBatchAdvRows([emptyBatchRow('ADVANCE')]);
      clearUploadInputs(form);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Open Resubmit Modal
  const openResubmitModal = (target: {
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    title: string;
    trackingCode: string;
    returnedReason?: string | null;
    returnedByRole?: string | null;
    returnedByName?: string | null;
    currentAmount: number;
    currentDescription: string;
    currentAccountOrCard: string;
    currentIban: string;
    currentBankName: string;
  }) => {
    setResubmitTarget(target);
    setResubmitAmount(String(target.currentAmount));
    setResubmitDescription(target.currentDescription);
    setResubmitAccountOrCard(target.currentAccountOrCard);
    setResubmitIban(target.currentIban==='IR'?'':target.currentIban);
    setResubmitError('');
    setResubmitBankName(target.currentBankName || 'بانک ملت');
    setResubmitAttachments([]);
  };

  const handleConfirmResubmit = async () => {
    if (!resubmitTarget) return;
    if(resubmitTarget.itemType!=='ADVANCE'){const error=bankFieldsError({accountOrCard:resubmitAccountOrCard,iban:resubmitIban});if(error){setResubmitError(error);return;}}
    setIsResubmitting(true);
    try {
      const ok = await onResubmitRequest({
        requesterId: currentUser.id,
        itemType: resubmitTarget.itemType,
        requestId: resubmitTarget.requestId,
        rowId: resubmitTarget.rowId,
        amount: Number(resubmitAmount) || resubmitTarget.currentAmount,
        description: resubmitDescription,
        accountOrCard: resubmitAccountOrCard,
        iban: resubmitIban,
        bankName: resubmitBankName,
        newAttachments: resubmitAttachments,
      });
      if (ok) {
        setResubmitTarget(null);
      }
    } finally {
      setIsResubmitting(false);
    }
  };

  // Find receipt for payment or advance
  const findReceiptForRequest = (reqId: string) => {
    return receiptArchives.find((r) => r.relatedPaymentIds.includes(reqId));
  };

  // Filter My Requests
  const isMyRequest = (reqRequesterId: string) => {
    if (currentUser.role === 'ADMIN') return true;
    return reqRequesterId === currentUser.id;
  };

  const myBatches = batchPayments.filter((b) => isMyRequest(b.requesterId));
  const myPayments = paymentRequests.filter((p) => isMyRequest(p.requesterId));
  const myAdvances = advanceRequests.filter((a) => isMyRequest(a.requesterId));
  // Missing batchType is the existing legacy payment-group contract.
  const visibleBatches = myBatches.filter((b) =>
    statusFilter === 'ADVANCE_BATCH' || statusFilter === 'ADVANCE_ALL'
      ? b.batchType === 'ADVANCE'
      : statusFilter === 'PAYMENT_BATCH' ? b.batchType !== 'ADVANCE' : true
  );

  // Extract all rows needing revision
  const needsRevisionItems: Array<{
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    trackingCode: string;
    title: string;
    payeeName: string;
    amount: number;
    returnedReason: string | null;
    returnedByRole: string | null;
    returnedByName: string | null;
    returnedAt: string | null;
    description: string;
    accountOrCard: string;
    iban: string;
    bankName: string;
    attachments?: AttachmentFile[];
  }> = [];

  // Check batches items
  myBatches.forEach((b) => {
    b.items.forEach((it, idx) => {
      if (it.status === 'Needs_Revision') {
        needsRevisionItems.push({
          itemType: 'BATCH_ITEM',
          requestId: b.id,
          rowId: it.id,
          trackingCode: `${b.trackingCode} (ردیف ${idx + 1})`,
          title: b.title,
          payeeName: it.payeeName,
          amount: it.amount,
          returnedReason: it.returnedReason || it.rejectionReason || null,
          returnedByRole: it.returnedByRole || 'تاییدکننده',
          returnedByName: it.returnedByName || null,
          returnedAt: it.returnedAt || null,
          description: it.description,
          accountOrCard: it.accountOrCard,
          iban: it.iban,
          bankName: it.bankName,
          attachments: it.attachments,
        });
      }
    });
  });

  // Check single payments
  myPayments.forEach((p) => {
    if (p.status === 'Needs_Revision') {
      needsRevisionItems.push({
        itemType: 'PAYMENT',
        requestId: p.id,
        trackingCode: p.trackingCode,
        title: p.description || 'دستور پرداخت تکی',
        payeeName: p.payeeName,
        amount: p.amount,
        returnedReason: p.returnedReason || p.rejectionReason || null,
        returnedByRole: p.returnedByRole || 'تاییدکننده',
        returnedByName: p.returnedByName || null,
        returnedAt: p.returnedAt || null,
        description: p.description,
        accountOrCard: p.accountOrCard,
        iban: p.iban,
        bankName: p.bankName,
        attachments: p.attachments,
      });
    }
  });

  // Check single advances
  myAdvances.forEach((a) => {
    if (a.status === 'Needs_Revision') {
      needsRevisionItems.push({
        itemType: 'ADVANCE',
        requestId: a.id,
        trackingCode: a.trackingCode,
        title: `مساعده ${a.requestedMonth}`,
        payeeName: a.requesterName,
        amount: a.amount,
        returnedReason: a.returnedReason || a.rejectionReason || null,
        returnedByRole: a.returnedByRole || 'تاییدکننده',
        returnedByName: a.returnedByName || null,
        returnedAt: a.returnedAt || null,
        description: a.reason,
        accountOrCard: '',
        iban: '',
        bankName: 'بانک حقوق',
        attachments: a.attachments,
      });
    }
  });

  // Calculate totals for batch forms
  const batchTotalSum = batchRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const batchAdvTotalSum = batchAdvRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Compact Context Header (Sub-menu selection is handled in the right sidebar) */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {activeFormTab === 'PAYMENT_BATCH' && 'فرم ثبت دستور پرداخت گروهی (تجمیعی)'}
            {activeFormTab === 'PAYMENT_SINGLE' && 'فرم ثبت دستور پرداخت تکی'}
            {activeFormTab === 'ADVANCE_BATCH' && 'فرم ثبت مساعده گروهی پرسنل'}
            {activeFormTab === 'ADVANCE_SINGLE' && 'فرم ثبت مساعده حقوق تکی'}
            {activeFormTab === 'CARTABLE' &&
              (statusFilter === 'NEEDS_REVISION'
                ? 'کارتابل پیگیری درخواست‌ها: نیازمند اصلاح و بازنگری'
                : statusFilter === 'PAYMENT_BATCH'
                ? 'کارتابل پیگیری درخواست‌ها: پرداخت‌های گروهی (تجمیعی)'
                : statusFilter === 'PAYMENT_SINGLE'
                ? 'کارتابل پیگیری درخواست‌ها: دستور پرداخت‌های تکی'
                : statusFilter === 'ADVANCE_SINGLE'
                ? 'کارتابل پیگیری درخواست‌ها: مساعده تکی'
                : statusFilter === 'ADVANCE_BATCH'
                ? 'کارتابل پیگیری درخواست‌ها: مساعده گروهی'
                : statusFilter === 'ADVANCE_ALL'
                ? 'کارتابل پیگیری درخواست‌ها: مساعده‌ها (تکی و گروهی)'
                : 'کارتابل پیگیری درخواست‌ها: همه درخواست‌ها و سوابق من')}{' '}
            ({currentUser.name})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            واحد: {currentUser.department} · سرپرست مستقیم شما: {currentUser.supervisorName || 'تعیین نشده'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-medium text-slate-700">
            کد پرسنلی: <strong className="font-mono-num">{currentUser.personnelCode}</strong>
          </span>
        </div>
      </section>

      {/* 2. Form Section based on Active Sidebar Sub-Menu */}
      {activeFormTab !== 'CARTABLE' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          {readingFiles && <p role="status" className="text-xs text-slate-600 mb-3">در حال خواندن مدارک؛ پس از آماده‌شدن فایل‌ها ثبت فعال می‌شود…</p>}
          {uploadError && <div role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-3"><p>{uploadError}</p><button type="button" className="mt-2 px-3 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer" onClick={event => {setUploadError(null);event.currentTarget.closest('section')?.querySelectorAll<HTMLInputElement>('form input[type="file"]').forEach(input => {input.value='';});}}>ادامه بدون فایل خوانده‌نشده</button></div>}
          {/* Form A: Group / Batch Payment Order */}
          {activeFormTab === 'PAYMENT_BATCH' && (
          <form onSubmit={handleBatchPaymentSubmit} className="space-y-4">
            <fieldset disabled={submitting || readingFiles} className="space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ثبت دستور پرداخت گروهی و چندردیفی (مأموریت، پاداش و فاکتورها)
                </h3>
                <p className="text-xs text-slate-500">
                  هر ردیف دارای شماره کارت ۱۶ رقمی، شبا، بانک مقصد، مدارک پیوست و وضعیت مستقل خواهد بود.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                  تعداد: <strong className="font-mono-num">{batchRows.length}</strong> ردیف
                </span>
                <span className="text-xs text-slate-900 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded border border-emerald-200">
                  جمع کل: <strong className="font-mono-num font-bold">{formatRial(batchTotalSum)}</strong> ریال
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                عنوان کلی لیست پرداخت تجمیعی:
              </label>
              <input
                type="text"
                required
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                placeholder="مثال: تسویه هزینه مأموریت و اضافه‌کاری نیروهای پروژه آبان‌ماه"
              />
            </div>

            {/* Batch Table - 100% Full Screen with zero horizontal scroll */}
            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-fixed text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700">
                    <th className="px-1.5 py-2.5 w-[4%] text-center">ردیف</th>
                    <th className="px-2 py-2.5 w-[13%]">نام ذینفع / نیرو</th>
                    <th className="px-2 py-2.5 w-[11%]">مبلغ (ریال)</th>
                    <th className="px-2 py-2.5 w-[15%]">شماره کارت (۱۶ رقمی)</th>
                    <th className="px-2 py-2.5 w-[17%]">شماره شبا (IBAN)</th>
                    <th className="px-2 py-2.5 w-[10%]">بانک مقصد</th>
                    <th className="px-2 py-2.5 w-[11%]">مرکز هزینه</th>
                    <th className="px-2 py-2.5 w-[11%]">شرح پرداخت</th>
                    <th className="px-1.5 py-2.5 w-[5%] text-center">مدارک</th>
                    <th className="px-1 py-2.5 w-[3%] text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batchRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 align-top">
                      <td className="px-1.5 py-2 text-center font-mono text-slate-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          required
                          value={row.payeeName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, payeeName: val } : r))
                            );
                          }}
                          placeholder="نام و نام خانوادگی"
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          required
                          min={1000}
                          value={row.amount || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                            );
                          }}
                          className="w-full px-2 py-1.5 text-xs font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded"
                        />
                        <div className="text-[10px] text-slate-500 font-mono-num mt-0.5 break-words">
                          {formatRial(row.amount)} ریال
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          dir="ltr"
                          {...cardInputProps}
                          value={row.accountOrCard}
                          onChange={(e) => {
                            const formatted = formatCardNumber(e.target.value);
                            const detected = detectBankFromCard(formatted);
                            setBatchRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      accountOrCard: formatted,
                                      bankName: detected || r.bankName,
                                    }
                                  : r
                              )
                            );
                          }}
                          placeholder="6037-xxxx-xxxx-xxxx"
                          className="w-full px-1.5 py-1.5 text-[11px] font-mono text-slate-900 bg-white border border-slate-300 rounded text-center"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          dir="ltr"
                          {...ibanInputProps}
                          value={row.iban}
                          onChange={(e) => {
                            const val = cleanIban(e.target.value);
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, iban: val } : r))
                            );
                          }}
                          placeholder="IR..."
                          className="w-full px-1.5 py-1.5 text-[11px] font-mono text-slate-700 bg-white border border-slate-300 rounded text-left"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.bankName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, bankName: val } : r))
                            );
                          }}
                          className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        >
                          {SYSTEM_BANKS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.costCenter}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, costCenter: val } : r))
                            );
                          }}
                          className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        >
                          {activeCostCenters.map((cc) => (
                            <option key={cc.id} value={cc.name}>
                              {cc.name} ({cc.code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, description: val } : r))
                            );
                          }}
                          placeholder="بابت ماموریت، پاداش، فاکتور..."
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <label className="inline-flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer text-[10px] text-slate-700 w-full">
                          <Paperclip className="w-3 h-3 text-slate-600 shrink-0" />
                          <span>{row.attachments?.length ? `${row.attachments.length}` : 'فایل'}</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf"
                            onChange={(e) => handleBatchRowFileUpload(e, idx, false)}
                            className="hidden"
                          />
                        </label>
                      </td>
                      <td className="px-1 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchRow(idx, false)}
                          disabled={batchRows.length <= 1}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleAddBatchRow(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن ردیف جدید به لیست</span>
              </button>

              <button
                type="submit"
                disabled={submitting || readingFiles || !!uploadError}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت نهایی و ارسال لیست جهت بررسی {currentUser.supervisorId ? 'سرپرست' : 'حسابداری'}</span>
              </button>
            </div>
            </fieldset>
          </form>
        )}

        {/* Form B: Single Payment Order */}
        {activeFormTab === 'PAYMENT_SINGLE' && (
          <form onSubmit={handleSinglePaymentSubmit} className="space-y-4 w-full">
            <fieldset disabled={submitting || readingFiles} className="space-y-4 min-w-0">
            <div className="pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">ثبت دستور پرداخت تکی</h3>
              <p className="text-xs text-slate-500">
                پرداخت به پیمانکار، شخص حقیقی، فاکتور خرید و امور جاری واحد
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">شرح و بابت پرداخت:</label>
              <textarea
                required
                rows={2}
                value={payDescription}
                onChange={(e) => setPayDescription(e.target.value)}
                placeholder="توضیح کامل در مورد علت و تعهد مالی این پرداخت..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مرکز هزینه مرتبط (از فهرست مراکز هزینه فعال سازمان):
                </label>
                <select
                  value={payCostCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                >
                  {activeCostCenters.map((cc) => (
                    <option key={cc.id} value={cc.name}>
                      {cc.name} — کد: {cc.code} ({cc.companyName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">نام ذینفع / گیرنده وجه:</label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="مثال: شرکت داده‌پردازی آریا"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">مبلغ پرداختی (ریال):</label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
                <span className="text-[11px] text-slate-500 font-mono-num mt-1 block">
                  معادل: <strong>{formatRial(Number(payAmount) || 0)} ریال</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">شماره کارت (۱۶ رقمی):</label>
                <input
                  type="text"
                  dir="ltr"
                  {...cardInputProps}
                  value={payAccountOrCard}
                  onChange={(e) => {
                    const formatted = formatCardNumber(e.target.value);
                    setPayAccountOrCard(formatted);
                    const detected = detectBankFromCard(formatted);
                    if (detected) setPayBankName(detected);
                  }}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-center tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">شماره شبا (IBAN):</label>
                <input
                  type="text"
                  dir="ltr"
                  {...ibanInputProps}
                  value={payIban}
                  onChange={(e) => setPayIban(cleanIban(e.target.value))}
                  placeholder="IR..."
                  className="w-full px-3 py-2 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">بانک مقصد:</label>
                <select
                  value={payBankName}
                  onChange={(e) => setPayBankName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                >
                  {SYSTEM_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اولویت پرداخت:</label>
                <select
                  value={payPriority}
                  onChange={(e) => setPayPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                >
                  <option value="Normal">عادی</option>
                  <option value="Urgent">فوری و اضطراری</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">شماره فاکتور / سند:</label>
                <input
                  type="text"
                  value={payInvoiceNumber}
                  onChange={(e) => setPayInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">موعد نیاز به پرداخت:</label>
                <input
                  type="text"
                  value={payDueDate}
                  onChange={(e) => setPayDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

            </div>

            {/* Attachments Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                پیوست مدارک و فاکتورها (تصویر فاکتور، قرارداد یا صورت‌حساب):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer text-slate-700 font-semibold">
                  <Upload className="w-3.5 h-3.5" />
                  <span>انتخاب فایل یا عکس</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={e => void readRequestFiles(e.target.files,uploaded => setPayAttachments(prev => [...prev,...uploaded]))}
                    className="hidden"
                  />
                </label>
                {payAttachments.map((f, i) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <span className="max-w-[150px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setPayAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-500 hover:text-rose-700 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 text-left">
              <button
                type="submit"
                disabled={submitting || readingFiles || !!uploadError}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ارسال دستور پرداخت به {currentUser.supervisorId ? 'سرپرست' : 'حسابداری'}</span>
              </button>
            </div>
            </fieldset>
          </form>
        )}

        {/* Form C: Group Advance Request (NEW!) */}
        {activeFormTab === 'ADVANCE_BATCH' && (
          <form onSubmit={handleBatchAdvanceSubmit} className="space-y-4">
            <fieldset disabled={submitting || readingFiles} className="space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ثبت مساعده گروهی پرسنل (درخواست سرپرست برای اعضای واحد)
                </h3>
                <p className="text-xs text-slate-500">
                  سرپرست واحد می‌تواند برای چند نفر از پرسنل به صورت یکجا تقاضای مساعده ثبت کند.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                  تعداد: <strong className="font-mono-num">{batchAdvRows.length}</strong> نفر
                </span>
                <span className="text-xs text-slate-900 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded border border-emerald-200">
                  مجموع مساعده‌ها: <strong className="font-mono-num font-bold">{formatRial(batchAdvTotalSum)}</strong> ریال
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                عنوان لیست مساعده گروهی:
              </label>
              <input
                type="text"
                required
                value={batchAdvTitle}
                onChange={(e) => setBatchAdvTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                placeholder="مثال: مساعده اضطراری پرسنل فنی و سایت کارگاهی آبان ۱۴۰۳"
              />
            </div>

            {/* Advance Batch Table - 100% Full Screen with zero horizontal scroll */}
            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-fixed text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700">
                    <th className="px-1.5 py-2.5 w-[4%] text-center">ردیف</th>
                    <th className="px-2 py-2.5 w-[15%]">نام پرسنل / متقاضی</th>
                    <th className="px-2 py-2.5 w-[13%]">مبلغ مساعده (ریال)</th>
                    <th className="px-2 py-2.5 w-[16%]">شماره کارت (۱۶ رقمی)</th>
                    <th className="px-2 py-2.5 w-[18%]">شماره شبا (IBAN)</th>
                    <th className="px-2 py-2.5 w-[9%]">ماه مساعده</th>
                    <th className="px-2 py-2.5 w-[16%]">علت درخواست</th>
                    <th className="px-1.5 py-2.5 w-[5%] text-center">مدارک</th>
                    <th className="px-1 py-2.5 w-[4%] text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batchAdvRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 align-top">
                      <td className="px-1.5 py-2 text-center font-mono text-slate-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          required
                          value={row.payeeName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, payeeName: val } : r))
                            );
                          }}
                          placeholder="نام و نام خانوادگی"
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          required
                          min={1000}
                          value={row.amount || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                            );
                          }}
                          className="w-full px-2 py-1.5 text-xs font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded"
                        />
                        <div className="text-[10px] text-slate-500 font-mono-num mt-0.5 break-words">
                          {formatRial(row.amount)} ریال
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          dir="ltr"
                          {...cardInputProps}
                          value={row.accountOrCard}
                          onChange={(e) => {
                            const formatted = formatCardNumber(e.target.value);
                            const detected = detectBankFromCard(formatted);
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      accountOrCard: formatted,
                                      bankName: detected || r.bankName,
                                    }
                                  : r
                              )
                            );
                          }}
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          className="w-full px-1.5 py-1.5 text-[11px] font-mono text-slate-900 bg-white border border-slate-300 rounded text-center"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          dir="ltr"
                          {...ibanInputProps}
                          value={row.iban}
                          onChange={(e) => {
                            const val = cleanIban(e.target.value);
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, iban: val } : r))
                            );
                          }}
                          placeholder="IR..."
                          className="w-full px-1.5 py-1.5 text-[11px] font-mono text-slate-700 bg-white border border-slate-300 rounded text-left"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.requestedMonth || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, requestedMonth: val } : r))
                            );
                          }}
                          className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-center"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchAdvRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, description: val } : r))
                            );
                          }}
                          placeholder="علت تقاضای مساعده..."
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <label className="inline-flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer text-[10px] text-slate-700 w-full">
                          <Paperclip className="w-3 h-3 text-slate-600 shrink-0" />
                          <span>{row.attachments?.length ? `${row.attachments.length}` : 'فایل'}</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf"
                            onChange={(e) => handleBatchRowFileUpload(e, idx, true)}
                            className="hidden"
                          />
                        </label>
                      </td>
                      <td className="px-1 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchRow(idx, true)}
                          disabled={batchAdvRows.length <= 1}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleAddBatchRow(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن نیروی جدید به لیست مساعده</span>
              </button>

              <button
                type="submit"
                disabled={submitting || readingFiles || !!uploadError}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت نهایی و ارسال لیست مساعده گروهی</span>
              </button>
            </div>
            </fieldset>
          </form>
        )}

        {/* Form D: Single Advance Request */}
        {activeFormTab === 'ADVANCE_SINGLE' && (
          <form onSubmit={handleSingleAdvanceSubmit} className="space-y-4 w-full">
            <fieldset disabled={submitting || readingFiles} className="space-y-4 min-w-0">
            <div className="pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">ثبت درخواست مساعده حقوق تکی</h3>
              <p className="text-xs text-slate-500">تقاضای دریافت مساعده ماهانه با بررسی سقف کارکرد</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ماه مورد تقاضا:</label>
                <input
                  type="text"
                  required
                  value={advRequestedMonth}
                  onChange={(e) => setAdvRequestedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">مبلغ درخواستی (ریال):</label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
                <span className="text-[11px] text-slate-500 font-mono-num mt-1 block">
                  معادل: <strong>{formatRial(Number(advAmount) || 0)} ریال</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تاریخ پیشنهادی دریافت:</label>
                <input
                  type="text"
                  value={advSuggestedDate}
                  onChange={(e) => setAdvSuggestedDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">علت و توضیحات تقاضا:</label>
              <textarea
                required
                rows={2}
                value={advReason}
                onChange={(e) => setAdvReason(e.target.value)}
                placeholder="توضیح کوتاه درباره علت نیاز به مساعده..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                پیوست مدارک و مستندات (اختیاری):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer text-slate-700 font-semibold">
                  <Upload className="w-3.5 h-3.5" />
                  <span>انتخاب فایل مدارک</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={e => void readRequestFiles(e.target.files,uploaded => setAdvAttachments(prev => [...prev,...uploaded]))}
                    className="hidden"
                  />
                </label>
                {advAttachments.map((f, i) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <span className="max-w-[150px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setAdvAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-500 hover:text-rose-700 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 text-left">
              <button
                type="submit"
                disabled={submitting || readingFiles || !!uploadError}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت و ارسال به {currentUser.supervisorId ? 'سرپرست واحد' : 'حسابداری'}</span>
              </button>
            </div>
            </fieldset>
          </form>
        )}
        </section>
      )}

      {/* 3. Cartable and History Section — ONLY shown when CARTABLE menu is active */}
      {activeFormTab === 'CARTABLE' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {statusFilter === 'NEEDS_REVISION' && 'درخواست‌ها و ردیف‌های نیازمند اصلاح و بازنگری'}
                {statusFilter === 'PAYMENT_BATCH' && 'پیگیری درخواست‌های پرداخت گروهی (تجمیعی)'}
                {statusFilter === 'PAYMENT_SINGLE' && 'پیگیری دستور پرداخت‌های تکی'}
                {statusFilter === 'ADVANCE_SINGLE' && 'پیگیری مساعده تکی'}
                {statusFilter === 'ADVANCE_BATCH' && 'پیگیری مساعده گروهی'}
                {statusFilter === 'ADVANCE_ALL' && 'پیگیری درخواست‌های مساعده (تکی و گروهی)'}
                {statusFilter === 'ALL' && 'کارتابل جامع پیگیری و سوابق درخواست‌های من'}
              </h3>
              <p className="text-xs text-slate-500">
                مشاهده وضعیت تأییدات، موارد برگشتی جهت اصلاح، و دریافت فیش‌های بانکی پرداخت‌شده (تغییر دسته‌بندی از منوی سمت راست)
              </p>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس کد، ذینفع، شرح یا مبلغ..."
                className="w-full pr-10 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
              />
            </div>
          </div>

          {/* Tab Content: 1. NEEDS REVISION SECTION */}
          {(statusFilter === 'ALL' || statusFilter === 'NEEDS_REVISION') && (
            <>
              {needsRevisionItems.length > 0 ? (
                <div className="p-4 bg-amber-50/60 border border-amber-300 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                    <h4 className="text-xs font-bold text-amber-950">
                      درخواست‌ها و ردیف‌های نیازمند اصلاح ({needsRevisionItems.length} مورد)
                    </h4>
                    <span className="text-[11px] text-amber-800 mr-auto">
                      ردیف‌های زیر توسط تاییدکننده یا حسابداری برگشت داده شده‌اند؛ لطفاً بررسی و ارسال مجدد نمایید.
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {needsRevisionItems.map((item, idx) => (
                      <div
                        key={`${item.requestId}-${item.rowId || idx}`}
                        className="bg-white p-3.5 border border-amber-200 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold text-slate-950 text-xs">{item.trackingCode}</span>
                            <span className="text-xs font-semibold text-slate-900">{item.payeeName}</span>
                            <span className="text-xs text-slate-500 font-mono-num font-bold">
                              {formatRial(item.amount)} ریال
                            </span>
                          </div>

                          <div className="text-xs text-amber-900 bg-amber-100/70 p-2 rounded border border-amber-300/60 font-medium">
                            <strong>علت برگشت ({item.returnedByName ? `${item.returnedByName} - ` : ''}{item.returnedByRole || 'تاییدکننده'}):</strong>{' '}
                            {item.returnedReason || 'لطفاً مستندات و مبلغ بازنگری گردد.'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openResubmitModal({
                                itemType: item.itemType,
                                requestId: item.requestId,
                                rowId: item.rowId,
                                title: item.title,
                                trackingCode: item.trackingCode,
                                returnedReason: item.returnedReason,
                                returnedByRole: item.returnedByRole,
                                returnedByName: item.returnedByName,
                                currentAmount: item.amount,
                                currentDescription: item.description,
                                currentAccountOrCard: item.accountOrCard,
                                currentIban: item.iban,
                                currentBankName: item.bankName,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>اصلاح و ارسال مجدد</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                statusFilter === 'NEEDS_REVISION' && (
                  <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                    در حال حاضر هیچ درخواست نیازمند اصلاحی در کارتابل شما وجود ندارد.
                  </div>
                )
              )}
            </>
          )}

          {/* Tab Content: 2. Group Requests */}
          {(statusFilter === 'ALL' || statusFilter === 'PAYMENT_BATCH' || statusFilter === 'ADVANCE_BATCH' || statusFilter === 'ADVANCE_ALL') && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>{statusFilter === 'ALL' ? 'درخواست‌های تجمیعی و گروهی' : statusFilter === 'PAYMENT_BATCH' ? 'درخواست‌های پرداخت گروهی' : 'درخواست‌های مساعده گروهی'}</span>
              <span className="text-slate-500">({visibleBatches.length} مورد)</span>
            </h4>

            {visibleBatches.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                {statusFilter === 'ALL' ? 'درخواست تجمیعی ثبت نشده است.' : statusFilter === 'PAYMENT_BATCH' ? 'درخواست پرداخت گروهی ثبت نشده است.' : 'درخواست مساعده گروهی ثبت نشده است.'}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleBatches.map((b) => (
                  <div key={b.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="p-3 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num font-bold text-slate-950 text-xs">{b.trackingCode}</span>
                          <span className="text-xs font-bold text-slate-900">{b.title}</span>
                          <span className="text-[11px] px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-medium">
                            {b.batchType === 'ADVANCE' ? 'مساعده گروهی' : 'دستور پرداخت گروهی'}
                          </span>
                        </div>
                        <OfficialReviewNotes row={b}/>
                        <div className="text-[11px] text-slate-600">
                          تعداد: <strong className="font-mono-num">{b.itemCount}</strong> ردیف · جمع کل:{' '}
                          <strong className="font-mono-num text-slate-950 font-bold">{formatRial(b.totalAmount)} ریال</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${getStatusTextClass(b.status)} bg-white border border-slate-200`}>
                          {getStatusLabel(b.status)}
                        </span>
                      </div>
                    </div>

                    {/* Rows - Full Screen without horizontal scroll */}
                    <div className="p-2.5 w-full">
                      <table className="w-full table-auto text-right border-collapse text-xs">
                        <thead>
                          <tr className="text-slate-600 bg-slate-50/60">
                            <th className="px-2 py-1.5 w-8 text-center">#</th>
                            <th className="px-2.5 py-1.5">ذینفع / نیرو</th>
                            <th className="px-2.5 py-1.5">مبلغ</th>
                            <th className="px-2.5 py-1.5">شماره کارت / شبا</th>
                            <th className="px-2.5 py-1.5">بانک</th>
                            <th className="px-2.5 py-1.5">وضعیت این ردیف</th>
                            <th className="px-2.5 py-1.5">مدارک</th>
                            <th className="px-2.5 py-1.5 text-center">اقدام</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {b.items.map((it, idx) => {
                            const isReturned = it.status === 'Needs_Revision';
                            return (
                              <tr key={it.id} className={`align-top ${isReturned ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50/60'}`}>
                                <td className="px-2 py-2 text-center font-mono text-slate-500">{idx + 1}</td>
                                <td className="px-2.5 py-2 font-semibold text-slate-900 break-words">{it.payeeName}<OfficialReviewNotes row={it}/></td>
                                <td className="px-2.5 py-2 font-mono-num font-bold text-slate-950 break-words">
                                  {formatRial(it.approvedAmount ?? it.amount)} ریال
                                  {it.approvedAmount && it.approvedAmount !== it.initialAmount && (
                                    <div className="text-[10px] text-slate-400 line-through">
                                      اولیه: {formatRial(it.initialAmount)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2.5 py-2 font-mono-num text-[11px] text-slate-600 break-all">
                                  {it.accountOrCard || it.iban || '—'}
                                </td>
                                <td className="px-2.5 py-2 text-slate-700 break-words">{it.bankName}</td>
                                <td className="px-2.5 py-2 break-words">
                                  <span className={`text-[11px] font-semibold ${getStatusTextClass(it.status || b.status)}`}>
                                    {getStatusLabel(it.status || b.status)}
                                  </span>
                                  {rejectionDescription(it) && <div className="text-[10px] text-rose-800 mt-0.5 break-words">{rejectionDescription(it)}</div>}
                                  {isReturned && (
                                    <div className="text-[10px] text-amber-800 mt-0.5 break-words">
                                      علت: {it.returnedReason}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2.5 py-2">
                                  {it.attachments && it.attachments.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewAttachment(it.attachments![0])}
                                      className="inline-flex items-center gap-1 text-[11px] text-sky-700 hover:text-sky-900 cursor-pointer"
                                    >
                                      <Paperclip className="w-3 h-3 shrink-0" />
                                      <span>{it.attachments.length} مدرک</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-2.5 py-2 text-center">
                                  {isReturned ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openResubmitModal({
                                          itemType: 'BATCH_ITEM',
                                          requestId: b.id,
                                          rowId: it.id,
                                          title: b.title,
                                          trackingCode: `${b.trackingCode} (ردیف ${idx + 1})`,
                                          returnedReason: it.returnedReason,
                                          returnedByRole: it.returnedByRole,
                                          returnedByName: it.returnedByName,
                                          currentAmount: it.amount,
                                          currentDescription: it.description,
                                          currentAccountOrCard: it.accountOrCard,
                                          currentIban: it.iban,
                                          currentBankName: it.bankName,
                                        })
                                      }
                                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                                    >
                                      اصلاح
                                    </button>
                                  ) : mayEditSubmitted(it,b.requesterId,b.supervisorId,'BATCH_ITEM',b.batchType==='ADVANCE') ? (
                                    <button type="button" onClick={()=>setEditSubmittedTarget({itemType:'BATCH_ITEM',requestId:b.id,rowId:it.id,trackingCode:`${b.trackingCode} — ردیف ${idx+1}`,row:it})} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 rounded hover:bg-blue-50 cursor-pointer"><Edit className="w-3 h-3"/>ویرایش</button>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">عادی</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: 3. Single Payments */}
        {(statusFilter === 'ALL' || statusFilter === 'PAYMENT_SINGLE') && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>دستور پرداخت‌های تکی</span>
              <span className="text-slate-500">({myPayments.length} مورد)</span>
            </h4>

            {myPayments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                دستور پرداختی ثبت نشده است.
              </div>
            ) : (
              <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full table-auto text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700">
                      <th className="px-2.5 py-2.5">کد رهگیری</th>
                      <th className="px-2.5 py-2.5">ذینفع و شرح</th>
                      <th className="px-2.5 py-2.5">مبلغ (ریال)</th>
                      <th className="px-2.5 py-2.5">بانک و کارت/شبا</th>
                      <th className="px-2.5 py-2.5">وضعیت</th>
                      <th className="px-2.5 py-2.5">فیش بانکی</th>
                      <th className="px-2.5 py-2.5 text-center">اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {myPayments.map((p) => {
                      const receipt = findReceiptForRequest(p.id);
                      const isReturned = p.status === 'Needs_Revision';
                      return (
                        <tr key={p.id} className={`align-top ${isReturned ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}`}>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">{p.trackingCode}</td>
                          <td className="px-2.5 py-2.5 font-medium text-slate-900 break-words">
                            <div className="font-bold">{p.payeeName}</div>
                            <div className="text-[11px] text-slate-500 break-words">{p.description}</div>
                            <OfficialReviewNotes row={p}/>
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-950 break-words">
                            {formatRial(p.amount)}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div>{p.bankName}</div>
                            {p.accountOrCard && (
                              <div className="text-[11px] font-mono-num text-slate-500 break-all">{p.accountOrCard}</div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 break-words">
                            <span className={getStatusTextClass(p.status)}>{getStatusLabel(p.status)}</span>
                            {rejectionDescription(p) && <div className="text-[10px] text-rose-800 mt-0.5 break-words">{rejectionDescription(p)}</div>}
                            {isReturned && (
                              <div className="text-[10px] text-amber-800 mt-0.5 break-words">
                                علت: {p.returnedReason}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5">
                            {receipt ? (
                              <button
                                type="button"
                                onClick={() => onOpenReceiptModal(receipt)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>فیش</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 text-center">
                            {isReturned ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openResubmitModal({
                                    itemType: 'PAYMENT',
                                    requestId: p.id,
                                    title: p.description,
                                    trackingCode: p.trackingCode,
                                    returnedReason: p.returnedReason,
                                    returnedByRole: p.returnedByRole,
                                    returnedByName: p.returnedByName,
                                    currentAmount: p.amount,
                                    currentDescription: p.description,
                                    currentAccountOrCard: p.accountOrCard,
                                    currentIban: p.iban,
                                    currentBankName: p.bankName,
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                              >
                                اصلاح و ارسال
                              </button>
                            ) : mayEditSubmitted(p,p.requesterId,p.supervisorId,'PAYMENT') ? (
                              <button type="button" onClick={()=>setEditSubmittedTarget({itemType:'PAYMENT',requestId:p.id,trackingCode:p.trackingCode,row:p})} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 rounded hover:bg-blue-50 cursor-pointer"><Edit className="w-3 h-3"/>ویرایش</button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: 4. Advances */}
        {(statusFilter === 'ALL' || statusFilter === 'ADVANCE_SINGLE' || statusFilter === 'ADVANCE_ALL') && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>درخواست‌های مساعده حقوق</span>
              <span className="text-slate-500">({myAdvances.length} مورد)</span>
            </h4>

            {myAdvances.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                درخواست مساعده‌ای ثبت نشده است.
              </div>
            ) : (
              <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full table-auto text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700">
                      <th className="px-2.5 py-2.5">کد رهگیری</th>
                      <th className="px-2.5 py-2.5">ماه</th>
                      <th className="px-2.5 py-2.5">مبلغ درخواستی</th>
                      <th className="px-2.5 py-2.5">مبلغ مصوب</th>
                      <th className="px-2.5 py-2.5">علت</th>
                      <th className="px-2.5 py-2.5">وضعیت</th>
                      <th className="px-2.5 py-2.5">فیش بانکی</th>
                      <th className="px-2.5 py-2.5 text-center">اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {myAdvances.map((adv) => {
                      const receipt = findReceiptForRequest(adv.id);
                      const isReturned = adv.status === 'Needs_Revision';
                      return (
                        <tr key={adv.id} className={`align-top ${isReturned ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}`}>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">{adv.trackingCode}</td>
                          <td className="px-2.5 py-2.5 text-slate-800 break-words">{adv.requestedMonth}</td>
                          <td className="px-2.5 py-2.5 font-mono-num text-slate-700 break-words">{formatRial(adv.amount)}</td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-950 break-words">
                            {adv.approvedAmount ? formatRial(adv.approvedAmount) : '—'}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-600 break-words">{adv.reason}<OfficialReviewNotes row={adv}/></td>
                          <td className="px-2.5 py-2.5 break-words">
                            <span className={getStatusTextClass(adv.status)}>{getStatusLabel(adv.status)}</span>
                            {rejectionDescription(adv) && <div className="text-[10px] text-rose-800 mt-0.5 break-words">{rejectionDescription(adv)}</div>}
                            {isReturned && (
                              <div className="text-[10px] text-amber-800 mt-0.5 break-words">
                                علت: {adv.returnedReason}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5">
                            {receipt ? (
                              <button
                                type="button"
                                onClick={() => onOpenReceiptModal(receipt)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>فیش</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 text-center">
                            {isReturned ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openResubmitModal({
                                    itemType: 'ADVANCE',
                                    requestId: adv.id,
                                    title: `مساعده ${adv.requestedMonth}`,
                                    trackingCode: adv.trackingCode,
                                    returnedReason: adv.returnedReason,
                                    returnedByRole: adv.returnedByRole,
                                    returnedByName: adv.returnedByName,
                                    currentAmount: adv.amount,
                                    currentDescription: adv.reason,
                                    currentAccountOrCard: '',
                                    currentIban: '',
                                    currentBankName: 'بانک حقوق',
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                              >
                                اصلاح و ارسال
                              </button>
                            ) : mayEditSubmitted(adv,adv.requesterId,adv.supervisorId,'ADVANCE') ? (
                              <button type="button" onClick={()=>setEditSubmittedTarget({itemType:'ADVANCE',requestId:adv.id,trackingCode:adv.trackingCode,row:adv})} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 rounded hover:bg-blue-50 cursor-pointer"><Edit className="w-3 h-3"/>ویرایش</button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </section>
      )}

      {/* 4. Resubmit Modal */}
      {editSubmittedTarget&&<SubmittedRequestEditDialog target={editSubmittedTarget} requesterId={currentUser.id} costCenters={activeCostCenters} canEditAttachments={Boolean(permissions.canViewAttachments)} onClose={()=>setEditSubmittedTarget(null)} onSave={onEditSubmittedRequest}/>}
      {resubmitTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  ویرایش و ارسال مجدد به صف تایید ({resubmitTarget.trackingCode})
                </h3>
                <p className="text-xs text-slate-500">{resubmitTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setResubmitTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Amber Alert of Return Reason */}
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4" />
                <span>علت برگشت داده شده توسط {resubmitTarget.returnedByName || resubmitTarget.returnedByRole || 'تاییدکننده'}:</span>
              </div>
              <p className="font-medium pr-5">
                {resubmitTarget.returnedReason || 'لطفاً اطلاعات و مدارک را اصلاح نمایید.'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مبلغ اصلاح‌شده (ریال):
                </label>
                <input
                  type="number"
                  value={resubmitAmount}
                  onChange={(e) => setResubmitAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg"
                />
                <span className="text-[11px] text-slate-500 font-mono-num mt-0.5 block">
                  {formatRial(Number(resubmitAmount) || 0)} ریال
                </span>
              </div>

              {resubmitError&&<p role="alert" className="text-xs text-rose-800">{resubmitError}</p>}
              {resubmitTarget.itemType !== 'ADVANCE' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">شماره شبا (IR و۲۴ رقم):
                    <input type="text" dir="ltr" {...ibanInputProps} value={resubmitIban} onChange={e=>setResubmitIban(cleanIban(e.target.value))} className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"/>
                  </label>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      شماره کارت ۱۶ رقمی:
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      {...cardInputProps}
                      value={resubmitAccountOrCard}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        setResubmitAccountOrCard(formatted);
                        const det = detectBankFromCard(formatted);
                        if (det) setResubmitBankName(det);
                      }}
                      className="w-full px-2 py-1.5 text-xs font-mono text-center bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">بانک مقصد:</label>
                    <select
                      value={resubmitBankName}
                      onChange={(e) => setResubmitBankName(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      {SYSTEM_BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  توضیحات و پاسخ به تاییدکننده:
                </label>
                <textarea
                  rows={2}
                  value={resubmitDescription}
                  onChange={(e) => setResubmitDescription(e.target.value)}
                  placeholder="توضیحات تکمیلی یا اصلاحات انجام شده را شرح دهید..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  افزودن مدارک جدید و اصلاحی:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer text-slate-700 font-semibold">
                    <Upload className="w-3.5 h-3.5" />
                    <span>انتخاب فاکتور یا مدرک تکمیلی</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const uploaded: AttachmentFile[] = [];
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          const url = await readFileAsDataUrl(file);
                          uploaded.push({
                            id: `att-${Date.now()}-${i}`,
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            url,
                            uploadedAt: '1403/08/28',
                            uploadedBy: currentUser.name,
                          });
                        }
                        setResubmitAttachments((prev) => [...prev, ...uploaded]);
                      }}
                      className="hidden"
                    />
                  </label>
                  {resubmitAttachments.map((f, i) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-slate-100 border border-slate-300 rounded"
                    >
                      <span>{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setResubmitAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setResubmitTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isResubmitting}
                onClick={handleConfirmResubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ارسال مجدد به کارتابل تأیید</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Attachment Preview Modal */}
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
              {previewAttachment.type.startsWith('image/') || previewAttachment.url.startsWith('data:image/') ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-h-80 w-auto object-contain rounded"
                />
              ) : (
                <div className="p-6 text-center text-xs text-slate-600">
                  <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                  <span>فایل سندی / PDF ({previewAttachment.name})</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono-num">
                حجم: {(previewAttachment.size / 1024).toFixed(1)} کیلوبایت · تاریخ: {previewAttachment.uploadedAt}
              </span>
              <a
                href={previewAttachment.url}
                download={previewAttachment.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
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
