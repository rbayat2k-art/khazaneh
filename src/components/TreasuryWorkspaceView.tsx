import React, { useState, useMemo, useEffect, useRef } from 'react';
import {OfficialReviewNotes} from './OfficialReviewNotes';
import {readPendingPayments,overlaps,confirmedPayment,clearPendingPayment,trackedPayment,paymentFingerprint,type PendingPayment,type PaymentOutcome,type PaymentLock} from '../utils/pending-payment';
import { todayJalali } from '../utils/current-date';
import {
  CheckSquare,
  PhoneCall,
  Lock,
  Folder,
  FolderOpen,
  Search,
  Upload,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  FileSpreadsheet,
  ArrowLeftRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  Info,
  Building2,
  PlusCircle,
  Edit,
  Star,
  Power,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import type {
  AdvanceRequest,
  PaymentRequest,
  BatchPaymentRequest,
  ManualPayment,
  DailyCover,
  ReceiptArchive,
  User,
  TreasurySubTab,
  CompanyBankAccount,
  PaymentMethodType,
} from '../types/treasury';
import {
  useSortableTable,
  formatRial,
  getStatusBadgeClasses,
  getStatusLabel,
  getPriorityBadgeClasses,
  getPriorityLabel,
  normalizePersianText,
  normalizeBankNumberSearch,
  normalizeDigits,
} from '../utils/sorting';
import { SortableHeader } from './SortableHeader';
import {
  buildUnifiedTreasuryItems,
  exportTreasuryItemsToExcel,
  type UnifiedTreasuryItem,
} from '../utils/excelExport';
import { SourceBankAccountSelector } from './SourceBankAccountSelector';
import { BankAccountImportDialog,type ImportBankAccounts } from './BankAccountImportDialog';
import {BANK_ACCOUNT_BANKS as SYSTEM_BANKS} from '../utils/bank-account-import';

const ALL_PAYMENT_METHODS: Array<{ id: PaymentMethodType; label: string }> = [
  { id: 'PAYA', label: 'پایا (حواله الکترونیک)' },
  { id: 'SATNA', label: 'ساتنا (حواله کلان)' },
  { id: 'CARD', label: 'کارت‌به‌کارت' },
  { id: 'INTERNAL', label: 'داخلی / حساب‌به‌حساب' },
  { id: 'CHECK', label: 'چک بانکی' },
];

interface TreasuryWorkspaceViewProps {
  currentUser: User;
  advanceRequests: AdvanceRequest[];
  paymentRequests: PaymentRequest[];
  batchPayments: BatchPaymentRequest[];
  manualPayments: ManualPayment[];
  dailyCovers: DailyCover[];
  receiptArchives: ReceiptArchive[];
  companyBankAccounts: CompanyBankAccount[];
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  initialSubTab?: TreasurySubTab;
  onMoveTreasuryPool: (payload: {
    items: Array<{
      id: string;
      type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'BATCH_ITEM';
      batchId?: string;
    }>;
    targetPool: 'IN_PAYMENT' | 'QUEUE';
    treasuryUserId: string;
    reason?: string;
  }) => Promise<boolean>;
  onExecutePayment: (payload: {
    items: Array<{
      id: string;
      type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'BATCH_ITEM';
      batchId?: string;
    }>;
    sourceBankAccountId: string;
    paidBankName: string;
    paymentAmount?: number;
    paymentMethod?: PaymentMethodType;
    bankRefNumber: string;
    dateJalali: string;
    treasuryUserId: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
    idempotencyKey?: string;
    expectedPaidAmounts?:Record<string,number>;
  }) => Promise<PaymentOutcome>;
  onRefreshState:()=>Promise<void>;
  onCreateManualPayment: (payload: {
    amount: number;
    payee: string;
    description: string;
    sourceBankAccountId: string;
    bankName: string;
    date: string;
    orderedBy: string;
    createdById: string;
    bankRefNumber: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCloseDailyCover: (payload: {
    date: string;
    bankName: string;
    sourceBankAccountId?: string;
    totalIn: number;
    bankFee: number;
    note: string;
    closedByUserId: string;
  }) => Promise<void>;
  onSaveBankAccount: (
    payload: Partial<CompanyBankAccount>
  ) => Promise<{ ok: boolean; account?: CompanyBankAccount; error?: string }>;
  onImportBankAccounts:ImportBankAccounts;
  onToggleBankAccountStatus: (payload: {
    accountId: string;
    isActive: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSetDefaultBankAccount: (payload: {
    accountId: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onOpenReceiptModal: (receipt: ReceiptArchive) => void;
  onShowToast?: (msg: string) => void;
}

export const TreasuryWorkspaceView: React.FC<TreasuryWorkspaceViewProps> = ({
  currentUser,
  advanceRequests,
  paymentRequests,
  batchPayments,
  manualPayments,
  dailyCovers,
  receiptArchives,
  companyBankAccounts,
  searchInputRef,
  initialSubTab = 'QUEUE',
  onMoveTreasuryPool,
  onExecutePayment,
  onRefreshState,
  onCreateManualPayment,
  onCloseDailyCover,
  onSaveBankAccount,
  onImportBankAccounts,
  onToggleBankAccountStatus,
  onSetDefaultBankAccount,
  onOpenReceiptModal,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<TreasurySubTab>(initialSubTab);
  const [showBankImport,setShowBankImport]=useState(false);
  const closeBankImport=React.useCallback(()=>setShowBankImport(false),[]);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [searchQuery, setSearchQuery] = useState('');

  // Selected items in Waiting Queue (Pending_Treasury)
  const [selectedQueueUids, setSelectedQueueUids] = useState<string[]>([]);
  // Selected items in In-Payment Pool (In_Payment)
  const [selectedInPaymentUids, setSelectedInPaymentUids] = useState<string[]>([]);
  // Selected items in Completed Payments (Paid)
  const [selectedCompletedUids, setSelectedCompletedUids] = useState<string[]>([]);

  // Filters for Completed Payments
  const [completedBankFilter, setCompletedBankFilter] = useState<string>('ALL');
  const [completedSourceAccountFilter, setCompletedSourceAccountFilter] = useState<string>('ALL');
  const [completedTypeFilter, setCompletedTypeFilter] = useState<string>('ALL');

  // Detail Modal for inspecting all form columns or batch items
  const [detailModalItem, setDetailModalItem] = useState<UnifiedTreasuryItem | null>(null);

  // Payment Execution Modal State
  const [paymentModalItems, setPaymentModalItems] = useState<UnifiedTreasuryItem[] | null>(null);
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('PAYA');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>('');
  const [bankRefNumber, setBankRefNumber] = useState<string>('');
  const [execDateJalali, setExecDateJalali] = useState<string>(todayJalali());
  const [uploadedReceiptDataUrl, setUploadedReceiptDataUrl] = useState<string>('');
  const [uploadedReceiptName, setUploadedReceiptName] = useState<string>('');
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [modalPending,setModalPending]=useState<PendingPayment|null>(null);
  const paymentGeneration=useRef(0),paymentActor=useRef(currentUser.id);paymentActor.current=currentUser.id;
  const paymentLock:PaymentLock=(name,work)=>{if(!navigator.locks)throw Error('برای پیگیری امن ثبت از مرورگر به‌روز و اتصال HTTPS استفاده کنید.');return navigator.locks.request(name,work);};
  const recoveredReceipt=useMemo(()=>modalPending?confirmedPayment(modalPending,currentUser.id,[...paymentRequests.map(row=>({target:'PAY:'+row.id,row})),...advanceRequests.map(row=>({target:'ADV:'+row.id,row})),...batchPayments.flatMap(b=>b.items.map(row=>({target:'BAT:'+b.id,row})))],receiptArchives):undefined,[modalPending,currentUser.id,paymentRequests,advanceRequests,batchPayments,receiptArchives]);
  useEffect(()=>{paymentGeneration.current++;setPaymentModalItems(null);setModalPending(null);setIsPaying(false);},[currentUser.id]);
  useEffect(()=>{if(recoveredReceipt)setPaymentModalError(null);},[recoveredReceipt]);
  const closePaymentModal=async()=>{
    if(isPaying)return;
    try{if(recoveredReceipt&&modalPending)await clearPendingPayment(localStorage,paymentLock,currentUser.id,modalPending.key);paymentGeneration.current++;setPaymentModalItems(null);setModalPending(null);}catch{setPaymentModalError('پیگیری ثبت پاک نشد؛ برای جلوگیری از تکرار، ابتدا مشکل ذخیره‌سازی مرورگر را رفع کنید.');}
  };
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isMovingPool, setIsMovingPool] = useState<boolean>(false);

  // Manual Payment Form State
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualPayee, setManualPayee] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualSourceAccountId, setManualSourceAccountId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(todayJalali());
  const [manualOrderedBy, setManualOrderedBy] = useState<string>('');
  const [manualRefNo, setManualRefNo] = useState<string>('');
  const [manualReceiptUrl, setManualReceiptUrl] = useState<string>('');
  const [manualReceiptName, setManualReceiptName] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  // Daily Cover State
  const [coverDate, setCoverDate] = useState<string>(todayJalali());
  const [coverBankName, setCoverBankName] = useState<string>('کلیه بانک‌ها');
  const [coverTotalIn, setCoverTotalIn] = useState<string>('');
  const [coverBankFee, setCoverBankFee] = useState<string>('');
  const [coverNote, setCoverNote] = useState<string>(
    ''
  );
  const [isClosingCover, setIsClosingCover] = useState<boolean>(false);

  // Archive Folder State
  const [archiveViewMode, setArchiveViewMode] = useState<'FOLDERS' | 'TABLE'>('FOLDERS');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);

  // Bank Accounts Management State
  const [bankAccountStatusFilter, setBankAccountStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL');
  const [showBankAccountModal, setShowBankAccountModal] = useState<boolean>(false);
  const [bankAccountModalOrigin, setBankAccountModalOrigin] = useState<
    'TAB' | 'PAYMENT_MODAL' | 'MANUAL_FORM'
  >('TAB');
  const [editingBankAccount, setEditingBankAccount] = useState<CompanyBankAccount | null>(null);
  const [formBankName, setFormBankName] = useState<string>(SYSTEM_BANKS[0]);
  const [formAccountTitle, setFormAccountTitle] = useState<string>('');
  const [formCompanyName, setFormCompanyName] = useState<string>(currentUser.company || '');
  const [formAccountNumber, setFormAccountNumber] = useState<string>('');
  const [formIban, setFormIban] = useState<string>('');
  const [formCardNumber, setFormCardNumber] = useState<string>('');
  const [formBranchName, setFormBranchName] = useState<string>('');
  const [formBranchCode, setFormBranchCode] = useState<string>('');
  const [formAccountType, setFormAccountType] = useState<'جاری' | 'کوتاه‌مدت' | 'پشتیبان' | 'تنخواه'>(
    'جاری'
  );
  const [formAllowedMethods, setFormAllowedMethods] = useState<PaymentMethodType[]>([
    'PAYA',
    'SATNA',
    'CARD',
    'INTERNAL',
  ]);
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');
  const [bankAccountFormError, setBankAccountFormError] = useState<string | null>(null);
  const [isSavingBankAccount, setIsSavingBankAccount] = useState<boolean>(false);

  // Default active source bank account selection
  const defaultActiveBankAccount = useMemo(() => {
    const activeList = companyBankAccounts.filter((a) => a.isActive);
    return activeList.find((a) => a.isDefault) || activeList[0] || null;
  }, [companyBankAccounts]);

  const initialBankSelectionApplied = useRef(false);
  useEffect(() => {
    if (initialBankSelectionApplied.current || !defaultActiveBankAccount) return;
    initialBankSelectionApplied.current = true;
    // Initial convenience only: clearing a selection must leave the account search open.
    setSelectedSourceAccountId(current => current || defaultActiveBankAccount.id);
    setManualSourceAccountId(current => current || defaultActiveBankAccount.id);
  }, [defaultActiveBankAccount]);

  const openPaymentModal = (items: UnifiedTreasuryItem[]) => {
    paymentGeneration.current++;
    setPaymentModalItems(items);
    setPaymentModalError(null);
    try{setModalPending(readPendingPayments(localStorage,currentUser.id).find(p=>overlaps(p,items.map(i=>i.uid)))||null);}catch{setModalPending(null);setPaymentModalError('پیگیری ثبت خوانده نشد؛ ارسال امن تا رفع مشکل ذخیره‌سازی ممکن نیست.');}
    if (!selectedSourceAccountId && defaultActiveBankAccount) {
      setSelectedSourceAccountId(defaultActiveBankAccount.id);
    } else {
      // Ensure selected account is still active
      const curr = companyBankAccounts.find((a) => a.id === selectedSourceAccountId);
      if (!curr || !curr.isActive) {
        setSelectedSourceAccountId(defaultActiveBankAccount?.id || '');
      }
    }
    if (items.length === 1) {
      setPartialPaymentAmount(String(items[0].remainingAmount ?? items[0].amount));
    } else {
      const total = items.reduce((s, i) => s + (i.remainingAmount ?? i.amount), 0);
      setPartialPaymentAmount(String(total));
    }
  };

  const openBankAccountCreateModal = (origin: 'TAB' | 'PAYMENT_MODAL' | 'MANUAL_FORM') => {
    setEditingBankAccount(null);
    setBankAccountModalOrigin(origin);
    setFormBankName(SYSTEM_BANKS[0]);
    setFormAccountTitle('');
    setFormCompanyName(currentUser.company || '');
    setFormAccountNumber('');
    setFormIban('');
    setFormCardNumber('');
    setFormBranchName('');
    setFormBranchCode('');
    setFormAccountType('جاری');
    setFormAllowedMethods(['PAYA', 'SATNA', 'CARD', 'INTERNAL']);
    setFormIsDefault(companyBankAccounts.filter((a) => a.isActive).length === 0);
    setFormIsActive(true);
    setFormDescription('');
    setBankAccountFormError(null);
    setShowBankAccountModal(true);
  };

  const openBankAccountEditModal = (acc: CompanyBankAccount) => {
    setEditingBankAccount(acc);
    setBankAccountModalOrigin('TAB');
    setFormBankName(acc.bankName);
    setFormAccountTitle(acc.accountTitle);
    setFormCompanyName(acc.companyName || '');
    setFormAccountNumber(acc.accountNumber);
    setFormIban(acc.iban || '');
    setFormCardNumber(acc.cardNumber || '');
    setFormBranchName(acc.branchName || '');
    setFormBranchCode(acc.branchCode || '');
    setFormAccountType((acc.accountType as any) || 'جاری');
    setFormAllowedMethods(
      acc.allowedPaymentMethods && acc.allowedPaymentMethods.length > 0
        ? acc.allowedPaymentMethods
        : ['PAYA', 'SATNA', 'CARD']
    );
    setFormIsDefault(Boolean(acc.isDefault));
    setFormIsActive(acc.isActive !== false && acc.status !== 'INACTIVE');
    setFormDescription(acc.description || '');
    setBankAccountFormError(null);
    setShowBankAccountModal(true);
  };

  const handleSaveBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankAccountFormError(null);

    const normalizedAccNum = normalizeDigits(formAccountNumber).trim();
    const normalizedIban = normalizeDigits(formIban)
      .replace(/[\s\-]/g, '')
      .toUpperCase();
    const normalizedCard = normalizeDigits(formCardNumber).replace(/[\s\-]/g, '');
    const normalizedBranchCode = normalizeDigits(formBranchCode).trim();

    if (!formBankName.trim() || !formAccountTitle.trim() || !normalizedAccNum) {
      setBankAccountFormError('نام بانک، عنوان حساب و شماره حساب مبدأ الزامی هستند.');
      return;
    }

    if (normalizedIban) {
      if (!/^IR\d{24}$/.test(normalizedIban)) {
        setBankAccountFormError(
          'فرمت شماره شبا نامعتبر است. شماره شبا باید با IR شروع شده و دقیقاً ۲۴ رقم داشته باشد (مجموعاً ۲۶ کاراکتر).'
        );
        return;
      }
    }

    if (normalizedCard && !/^\d{16}$/.test(normalizedCard)) {
      setBankAccountFormError('شماره کارت بانکی در صورت ورود باید دقیقاً ۱۶ رقم باشد.');
      return;
    }

    setIsSavingBankAccount(true);
    try {
      const res = await onSaveBankAccount({
        id: editingBankAccount?.id,
        bankName: formBankName.trim(),
        accountTitle: formAccountTitle.trim(),
        companyName: formCompanyName.trim() || '',
        accountNumber: normalizedAccNum,
        iban: normalizedIban === 'IR' ? '' : normalizedIban,
        cardNumber: normalizedCard,
        branchName: formBranchName.trim(),
        branchCode: normalizedBranchCode,
        accountType: formAccountType,
        currency: 'IRR',
        allowedPaymentMethods:
          formAllowedMethods.length > 0 ? formAllowedMethods : ['PAYA', 'SATNA'],
        isDefault: formIsDefault,
        isActive: formIsActive,
        description: formDescription.trim(),
      });

      if (!res.ok) {
        setBankAccountFormError(res.error || 'خطا در ذخیره حساب بانکی مبدأ');
        return;
      }

      if (res.account) {
        if (bankAccountModalOrigin === 'PAYMENT_MODAL' && res.account.isActive) {
          setSelectedSourceAccountId(res.account.id);
        } else if (bankAccountModalOrigin === 'MANUAL_FORM' && res.account.isActive) {
          setManualSourceAccountId(res.account.id);
        }
      }
      setShowBankAccountModal(false);
    } finally {
      setIsSavingBankAccount(false);
    }
  };

  // Build Unified Items for Waiting Queue (Pending_Treasury)
  const unifiedPendingQueue = useMemo<UnifiedTreasuryItem[]>(() => {
    return buildUnifiedTreasuryItems({
      batchPayments,
      paymentRequests,
      advanceRequests,
      manualPayments: [],
      receiptArchives,
      targetStatuses: ['Pending_Treasury'],
      includeManuals: false,
    });
  }, [advanceRequests, paymentRequests, batchPayments, receiptArchives]);

  // Build Unified Items for In-Payment Pool (In_Payment)
  const unifiedInPaymentPool = useMemo<UnifiedTreasuryItem[]>(() => {
    return buildUnifiedTreasuryItems({
      batchPayments,
      paymentRequests,
      advanceRequests,
      manualPayments: [],
      receiptArchives,
      targetStatuses: ['In_Payment'],
      includeManuals: false,
    });
  }, [advanceRequests, paymentRequests, batchPayments, receiptArchives]);

  // Build Unified Items for Completed Payments (Paid + Manual Payments)
  const unifiedCompletedPayments = useMemo<UnifiedTreasuryItem[]>(() => {
    return buildUnifiedTreasuryItems({
      batchPayments,
      paymentRequests,
      advanceRequests,
      manualPayments,
      receiptArchives,
      targetStatuses: ['Paid'],
      includeManuals: true,
    });
  }, [advanceRequests, paymentRequests, batchPayments, manualPayments, receiptArchives]);

  // Filter function for search query
  const matchesSearch = (item: UnifiedTreasuryItem, q: string): boolean => {
    if (!q) return true;
    const normQ = normalizePersianText(q);
    const numQ = normalizeBankNumberSearch(q);
    const snap = item.sourceAccountSnapshot;
    const textMatch =
      normalizePersianText(item.trackingCode).includes(normQ) ||
      normalizePersianText(item.title).includes(normQ) ||
      normalizePersianText(item.payeeName).includes(normQ) ||
      normalizePersianText(item.department).includes(normQ) ||
      normalizePersianText(item.costCenter).includes(normQ) ||
      normalizePersianText(item.destinationBank).includes(normQ) ||
      normalizePersianText(item.paidBankName).includes(normQ) ||
      normalizePersianText(snap?.bankName).includes(normQ) ||
      normalizePersianText(snap?.accountTitle).includes(normQ) ||
      normalizePersianText(item.accountOrCard).includes(normQ) ||
      normalizePersianText(item.iban).includes(normQ) ||
      normalizePersianText(item.invoiceNumber).includes(normQ) ||
      normalizePersianText(item.requesterName).includes(normQ);

    if (textMatch) return true;
    if (numQ) {
      return (
        normalizeBankNumberSearch(item.accountOrCard).includes(numQ) ||
        normalizeBankNumberSearch(item.iban).includes(numQ) ||
        normalizeBankNumberSearch(snap?.accountNumber).includes(numQ) ||
        normalizeBankNumberSearch(snap?.iban).includes(numQ) ||
        normalizeBankNumberSearch(item.bankRefNumber).includes(numQ)
      );
    }
    return false;
  };

  const filteredQueue = useMemo(() => {
    return unifiedPendingQueue.filter((i) => matchesSearch(i, searchQuery));
  }, [unifiedPendingQueue, searchQuery]);

  const filteredInPayment = useMemo(() => {
    return unifiedInPaymentPool.filter((i) => matchesSearch(i, searchQuery));
  }, [unifiedInPaymentPool, searchQuery]);

  const filteredCompleted = useMemo(() => {
    return unifiedCompletedPayments.filter((i) => {
      if (!matchesSearch(i, searchQuery)) return false;
      if (completedBankFilter !== 'ALL' && i.paidBankName !== completedBankFilter) return false;
      if (
        completedSourceAccountFilter !== 'ALL' &&
        i.sourceBankAccountId !== completedSourceAccountFilter &&
        i.sourceAccountSnapshot?.accountId !== completedSourceAccountFilter
      ) {
        return false;
      }
      if (completedTypeFilter !== 'ALL' && i.type !== completedTypeFilter) return false;
      return true;
    });
  }, [
    unifiedCompletedPayments,
    searchQuery,
    completedBankFilter,
    completedSourceAccountFilter,
    completedTypeFilter,
  ]);

  const filteredBankAccounts = useMemo(() => {
    const normQ = normalizePersianText(searchQuery);
    const numQ = normalizeBankNumberSearch(searchQuery);
    return companyBankAccounts.filter((acc) => {
      if (bankAccountStatusFilter === 'ACTIVE' && !acc.isActive) return false;
      if (bankAccountStatusFilter === 'INACTIVE' && acc.isActive) return false;
      if (!normQ && !numQ) return true;
      const textHit =
        normalizePersianText(acc.bankName).includes(normQ) ||
        normalizePersianText(acc.accountTitle).includes(normQ) ||
        normalizePersianText(acc.companyName).includes(normQ) ||
        normalizePersianText(acc.branchName).includes(normQ) ||
        normalizePersianText(acc.accountType).includes(normQ);
      if (textHit) return true;
      if (numQ) {
        return (
          normalizeBankNumberSearch(acc.accountNumber).includes(numQ) ||
          normalizeBankNumberSearch(acc.iban).includes(numQ) ||
          normalizeBankNumberSearch(acc.cardNumber).includes(numQ) ||
          normalizeBankNumberSearch(acc.branchCode).includes(numQ)
        );
      }
      return false;
    });
  }, [companyBankAccounts, searchQuery, bankAccountStatusFilter]);

  const {
    sortedItems: sortedQueue,
    sortConfig: queueSort,
    handleSort: handleQueueSort,
  } = useSortableTable(filteredQueue, 'dueDate', 'jalali_date', 'asc');

  const {
    sortedItems: sortedInPayment,
    sortConfig: inPaySort,
    handleSort: handleInPaySort,
  } = useSortableTable(filteredInPayment, 'dueDate', 'jalali_date', 'asc');

  const {
    sortedItems: sortedCompleted,
    sortConfig: completedSort,
    handleSort: handleCompletedSort,
  } = useSortableTable(filteredCompleted, 'paidDateJalali', 'jalali_date', 'desc');

  const {
    sortedItems: sortedManual,
    sortConfig: manualSort,
    handleSort: handleManualSort,
  } = useSortableTable(manualPayments, 'date', 'jalali_date', 'desc');

  const {
    sortedItems: sortedCovers,
    sortConfig: coverSort,
    handleSort: handleCoverSort,
  } = useSortableTable(dailyCovers, 'date', 'jalali_date', 'desc');

  const {
    sortedItems: sortedReceipts,
    sortConfig: receiptSort,
    handleSort: handleReceiptSort,
  } = useSortableTable(receiptArchives, 'dateJalali', 'jalali_date', 'desc');

  const {
    sortedItems: sortedBankAccounts,
    sortConfig: bankAccSort,
    handleSort: handleBankAccSort,
  } = useSortableTable(filteredBankAccounts, 'bankName', 'text', 'asc');

  // Group Receipts by Day Folder
  const dayFolders = useMemo(() => {
    const map = new Map<string, ReceiptArchive[]>();
    sortedReceipts.forEach((r) => {
      const day = r.dateJalali || '1403/08/28';
      const list = map.get(day) || [];
      list.push(r);
      map.set(day, list);
    });
    return Array.from(map.entries()).map(([day, receipts]) => ({
      day,
      receipts,
      totalAmount: receipts.reduce((sum, item) => sum + item.amount, 0),
    }));
  }, [sortedReceipts]);

  const toggleFolderExpand = (day: string) => {
    setExpandedFolders((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Selection Helpers for Queue
  const toggleSelectQueueItem = (uid: string) => {
    setSelectedQueueUids((prev) =>
      prev.includes(uid) ? prev.filter((k) => k !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAllQueue = () => {
    if (selectedQueueUids.length === sortedQueue.length) {
      setSelectedQueueUids([]);
    } else {
      setSelectedQueueUids(sortedQueue.map((i) => i.uid));
    }
  };

  const selectedQueueObjects = useMemo(() => {
    return sortedQueue.filter((i) => selectedQueueUids.includes(i.uid));
  }, [sortedQueue, selectedQueueUids]);

  const selectedQueueSum = useMemo(() => {
    return selectedQueueObjects.reduce((acc, i) => acc + (i.remainingAmount ?? i.amount), 0);
  }, [selectedQueueObjects]);

  // Selection Helpers for In-Payment Pool
  const toggleSelectInPaymentItem = (uid: string) => {
    setSelectedInPaymentUids((prev) =>
      prev.includes(uid) ? prev.filter((k) => k !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAllInPayment = () => {
    if (selectedInPaymentUids.length === sortedInPayment.length) {
      setSelectedInPaymentUids([]);
    } else {
      setSelectedInPaymentUids(sortedInPayment.map((i) => i.uid));
    }
  };

  const selectedInPaymentObjects = useMemo(() => {
    return sortedInPayment.filter((i) => selectedInPaymentUids.includes(i.uid));
  }, [sortedInPayment, selectedInPaymentUids]);

  const selectedInPaymentSum = useMemo(() => {
    return selectedInPaymentObjects.reduce((acc, i) => acc + (i.remainingAmount ?? i.amount), 0);
  }, [selectedInPaymentObjects]);

  // Selection Helpers for Completed Payments
  const toggleSelectCompletedItem = (uid: string) => {
    setSelectedCompletedUids((prev) =>
      prev.includes(uid) ? prev.filter((k) => k !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAllCompleted = () => {
    if (selectedCompletedUids.length === sortedCompleted.length) {
      setSelectedCompletedUids([]);
    } else {
      setSelectedCompletedUids(sortedCompleted.map((i) => i.uid));
    }
  };

  const selectedCompletedObjects = useMemo(() => {
    return sortedCompleted.filter((i) => selectedCompletedUids.includes(i.uid));
  }, [sortedCompleted, selectedCompletedUids]);

  // Export Excel & Move to In-Payment Pool
  const handleExportQueueAndMoveToInPayment = async (itemsToProcess: UnifiedTreasuryItem[]) => {
    if (itemsToProcess.length === 0) return;

    const exportRes = exportTreasuryItemsToExcel(itemsToProcess, {
      fileNamePrefix: 'treasury-payment-export',
      sheetTitle: 'لیست دستور پرداخت و مشخصات کامل بانکی ذینفعان جهت پرداخت',
    });

    setIsMovingPool(true);
    try {
      const ok = await onMoveTreasuryPool({
        items: itemsToProcess
          .filter((i) => i.type !== 'MANUAL')
          .map((i) => ({
            id: i.id,
            type: i.type as 'ADVANCE' | 'PAYMENT' | 'BATCH',
          })),
        targetPool: 'IN_PAYMENT',
        treasuryUserId: currentUser.id,
        reason: `دریافت خروجی اکسل (${exportRes.fileName}) و انتقال به مخزن در حال پرداخت`,
      });
      if (ok) {
        setSelectedQueueUids([]);
        setSubTab('IN_PAYMENT');
      }
    } finally {
      setIsMovingPool(false);
    }
  };

  // Move items between Queue and In-Payment without Excel
  const handleMoveItemsBetweenPools = async (
    itemsToMove: UnifiedTreasuryItem[],
    targetPool: 'IN_PAYMENT' | 'QUEUE'
  ) => {
    if (itemsToMove.length === 0) return;
    setIsMovingPool(true);
    try {
      const ok = await onMoveTreasuryPool({
        items: itemsToMove
          .filter((i) => i.type !== 'MANUAL')
          .map((i) => ({
            id: i.id,
            type: i.type as 'ADVANCE' | 'PAYMENT' | 'BATCH',
          })),
        targetPool,
        treasuryUserId: currentUser.id,
      });
      if (ok) {
        if (targetPool === 'IN_PAYMENT') {
          setSelectedQueueUids([]);
        } else {
          setSelectedInPaymentUids([]);
        }
      }
    } finally {
      setIsMovingPool(false);
    }
  };

  // Export Excel only
  const handleExportExcelOnly = (
    itemsToExport: UnifiedTreasuryItem[],
    prefix: string,
    sheetTitle: string
  ) => {
    if (itemsToExport.length === 0) return;
    const res = exportTreasuryItemsToExcel(itemsToExport, {
      fileNamePrefix: prefix,
      sheetTitle,
    });
    if (onShowToast) {
      onShowToast(
        `فایل اکسل «${res.fileName}» شامل ${res.rowCount} ردیف با تمامی ستون‌های فرم‌ها دانلود شد.`
      );
    }
  };

  const handleReceiptFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'MODAL' | 'MANUAL'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (target === 'MODAL') {
        setUploadedReceiptDataUrl(result);
        setUploadedReceiptName(file.name);
      } else {
        setManualReceiptUrl(result);
        setManualReceiptName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedModalSourceAccount = useMemo(() => {
    return (
      companyBankAccounts.find((a) => a.id === selectedSourceAccountId && a.isActive) || null
    );
  }, [companyBankAccounts, selectedSourceAccountId]);

  const handleConfirmPaymentExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentModalError(null);
    if (!paymentModalItems || paymentModalItems.length === 0) return;

    if (!selectedModalSourceAccount) {
      setPaymentModalError(
        'انتخاب یک حساب بانکی مبدأ فعال شرکت برای ثبت پرداخت الزامی است.'
      );
      return;
    }

    const totalRemaining = paymentModalItems.reduce(
      (acc, i) => acc + (i.remainingAmount ?? i.amount),
      0
    );
    const isSingleItem = paymentModalItems.length === 1 && paymentModalItems[0].type !== 'BATCH';
    const numericPayAmt = isSingleItem
      ? Number(normalizeDigits(partialPaymentAmount))
      : totalRemaining;

    if(recoveredReceipt)return;
    if (!Number.isSafeInteger(numericPayAmt) || numericPayAmt <= 0) {
      setPaymentModalError('مبلغ پرداخت باید بزرگ‌تر از صفر ریال باشد.');
      return;
    }

    if (isSingleItem && numericPayAmt > totalRemaining) {
      setPaymentModalError(
        `مبلغ پرداخت (${formatRial(numericPayAmt)} ریال) نمی‌تواند بیشتر از مانده قابل پرداخت (${formatRial(totalRemaining)} ریال) باشد.`
      );
      return;
    }

    const normalizedRefNo = normalizeDigits(bankRefNumber).trim();
    if (!normalizedRefNo) {
      setPaymentModalError('ورود شماره مرجع / پیگیری بانکی الزامی است.');
      return;
    }

    setIsPaying(true);
    const generation=paymentGeneration.current,actor=currentUser.id;
    try {
      const expectedPaidAmounts:Record<string,number>={};
      for(const item of paymentModalItems){if(item.type==='BATCH'){for(const row of item.rawBatch?.items||[])if(row.status!=='Paid')expectedPaidAmounts[`BATCH_ITEM:${item.id}:${row.id}`]=row.paidAmountSoFar??row.paidAmount??0;}else if(item.type!=='MANUAL')expectedPaidAmounts[`${item.type}:${item.id}`]=item.paidAmountSoFar||0;}
      const payload={
        items: paymentModalItems
          .filter((i) => i.type !== 'MANUAL')
          .map((i) => ({ id: i.id, type: i.type as 'ADVANCE' | 'PAYMENT' | 'BATCH' })),
        sourceBankAccountId: selectedModalSourceAccount.id,
        paidBankName: selectedModalSourceAccount.bankName,
        paymentAmount: isSingleItem ? numericPayAmt : undefined,
        paymentMethod: selectedPaymentMethod,
        bankRefNumber: normalizedRefNo,
        dateJalali: execDateJalali,
        treasuryUserId: currentUser.id,
        receiptFileUrl: uploadedReceiptDataUrl || undefined,
        receiptFileName: uploadedReceiptName || undefined,
        expectedPaidAmounts,
      };
      const fingerprint=await paymentFingerprint(payload);
      const res=await trackedPayment(localStorage,paymentLock,actor,paymentModalItems.map(i=>i.uid),fingerprint,()=>paymentGeneration.current===generation&&paymentActor.current===actor,async key=>{
        setModalPending(readPendingPayments(localStorage,actor).find(p=>p.key===key)||null);
        return onExecutePayment({...payload,idempotencyKey:key});
      });
      if(paymentGeneration.current!==generation||paymentActor.current!==actor)return;
      setModalPending(readPendingPayments(localStorage,actor).find(p=>overlaps(p,paymentModalItems.map(i=>i.uid)))||null);

      if (!res.ok) {
        setPaymentModalError(res.error || 'خطا در ثبت پرداخت در سرور');
        return;
      }

      setPaymentModalItems(null);
      setSelectedQueueUids([]);
      setSelectedInPaymentUids([]);
      setBankRefNumber('');
      setUploadedReceiptDataUrl('');
      setUploadedReceiptName('');
    } catch {
      if(paymentGeneration.current===generation&&paymentActor.current===actor)setPaymentModalError('شناسه پیگیری حفظ یا بررسی نشد؛ ارسال متوقف است. ذخیره‌سازی مرورگر و اتصال امن را بررسی کنید.');
    } finally {
      if(paymentGeneration.current===generation&&paymentActor.current===actor)setIsPaying(false);
    }
  };

  const selectedManualSourceAccount = useMemo(() => {
    return (
      companyBankAccounts.find((a) => a.id === manualSourceAccountId && a.isActive) || null
    );
  }, [companyBankAccounts, manualSourceAccountId]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const numAmt = Number(normalizeDigits(manualAmount));
    if (!manualPayee.trim() || !numAmt || numAmt <= 0) {
      setManualError('نام ذینفع و مبلغ معتبر الزامی است.');
      return;
    }
    if (!selectedManualSourceAccount) {
      setManualError('انتخاب حساب بانکی مبدأ فعال شرکت الزامی است.');
      return;
    }
    const normalizedRef = normalizeDigits(manualRefNo).trim();
    if (!normalizedRef) {
      setManualError('شماره مرجع / پیگیری بانکی الزامی است.');
      return;
    }

    setIsSavingManual(true);
    try {
      const res = await onCreateManualPayment({
        amount: numAmt,
        payee: manualPayee.trim(),
        description: manualDescription.trim() || 'پرداخت تلفنی خارج از نوبت',
        sourceBankAccountId: selectedManualSourceAccount.id,
        bankName: selectedManualSourceAccount.bankName,
        date: manualDate,
        orderedBy: manualOrderedBy,
        createdById: currentUser.id,
        bankRefNumber: normalizedRef,
        receiptFileUrl: manualReceiptUrl || undefined,
        receiptFileName: manualReceiptName || undefined,
      });
      if (!res.ok) {
        setManualError(res.error || 'خطا در ثبت پرداخت دستی');
        return;
      }
      setManualPayee('');
      setManualDescription('');
      setManualRefNo('');
      setManualReceiptUrl('');
      setManualReceiptName('');
    } finally {
      setIsSavingManual(false);
    }
  };

  // Daily Cover Real-Time Calculations
  const todayCoverTransactions = useMemo(() => {
    const advances = advanceRequests.filter(
      (a) =>
        a.status === 'Paid' &&
        a.paidDateJalali === coverDate &&
        (coverBankName === 'کلیه بانک‌ها' || a.paidBankName === coverBankName)
    );
    const payments = paymentRequests.filter(
      (p) =>
        p.status === 'Paid' &&
        p.paidDateJalali === coverDate &&
        (coverBankName === 'کلیه بانک‌ها' || p.paidBankName === coverBankName)
    );
    const batches = batchPayments.filter(
      (b) =>
        b.status === 'Paid' &&
        b.paidDateJalali === coverDate &&
        (coverBankName === 'کلیه بانک‌ها' || b.paidBankName === coverBankName)
    );
    const manuals = manualPayments.filter(
      (m) =>
        m.date === coverDate &&
        (coverBankName === 'کلیه بانک‌ها' || m.bankName === coverBankName)
    );

    const sumAdv = advances.reduce((acc, a) => acc + (a.approvedAmount ?? a.amount), 0);
    const sumPay = payments.reduce((acc, p) => acc + (p.approvedAmount ?? p.amount), 0);
    const sumBat = batches.reduce((acc, b) => acc + b.totalAmount, 0);
    const sumMan = manuals.reduce((acc, m) => acc + m.amount, 0);
    const fee = Number(coverBankFee) || 0;
    const totalInNum = Number(coverTotalIn) || 0;
    const totalOutNum = sumAdv + sumPay + sumBat + sumMan + fee;

    return {
      advances,
      payments,
      batches,
      manuals,
      sumAdv,
      sumPay,
      sumBat,
      sumMan,
      fee,
      totalInNum,
      totalOutNum,
      netFlow: totalInNum - totalOutNum,
    };
  }, [
    advanceRequests,
    paymentRequests,
    batchPayments,
    manualPayments,
    coverDate,
    coverBankName,
    coverBankFee,
    coverTotalIn,
  ]);

  const handleConfirmCloseCover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsClosingCover(true);
    try {
      await onCloseDailyCover({
        date: coverDate,
        bankName: coverBankName,
        totalIn: Number(coverTotalIn) || 0,
        bankFee: Number(coverBankFee) || 0,
        note: coverNote,
        closedByUserId: currentUser.id,
      });
    } finally {
      setIsClosingCover(false);
    }
  };

  const toggleAllowedPaymentMethod = (methodId: PaymentMethodType) => {
    setFormAllowedMethods((prev) =>
      prev.includes(methodId) ? prev.filter((m) => m !== methodId) : [...prev, methodId]
    );
  };

  const activeSubTabMeta = useMemo(() => {
    switch (subTab) {
      case 'QUEUE':
        return {
          title: 'صف انتظار پرداخت خزانه',
          subtitle: 'درخواست‌ها و ردیف‌های تأییدشده نهایی آماده پرداخت یا انتقال به مخزن',
          count: unifiedPendingQueue.length,
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
        };
      case 'IN_PAYMENT':
        return {
          title: 'مخزن اسناد در حال پرداخت',
          subtitle: 'اسناد ارسال‌شده به بانک عامل در جریان تسویه پایا / ساتنا',
          count: unifiedInPaymentPool.length,
          badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
        };
      case 'COMPLETED':
        return {
          title: 'فهرست پرداختی‌های انجام‌شده',
          subtitle: 'سوابق تسویه نهایی، شماره‌های مرجع بانکی و فیش‌های صادرشده',
          count: unifiedCompletedPayments.length,
          badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        };
      case 'BANK_ACCOUNTS':
        return {
          title: 'مدیریت بانک‌ها و شماره‌حساب‌های مبدأ شرکت',
          subtitle: 'تعریف و مدیریت حساب‌های بانکی فعال شرکت جهت صدور دستور پرداخت',
          count: companyBankAccounts.filter((a) => a.isActive).length,
          badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
        };
      case 'MANUAL':
        return {
          title: 'ثبت پرداخت تلفنی / کاغذی (خارج از نوبت)',
          subtitle: 'ثبت مستقیم دستور پرداخت‌های اضطراری و تلفنی همراه با پیوست فیش',
          count: manualPayments.length,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        };
      case 'COVER':
        return {
          title: 'روکش روزانه خزانه و بانک‌ها',
          subtitle: 'تطبیق گردش ورودی و خروجی روزانه بانک‌ها و بستن حساب روز',
          count: dailyCovers.length,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        };
      case 'ARCHIVE':
        return {
          title: 'بایگانی فیش‌ها و پوشه‌های روز پرداخت',
          subtitle: 'آرشیو طبقه‌بندی‌شده فیش‌های واریزی بر اساس تاریخ و بانک مبدأ',
          count: receiptArchives.length,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  }, [
    subTab,
    unifiedPendingQueue.length,
    unifiedInPaymentPool.length,
    unifiedCompletedPayments.length,
    companyBankAccounts,
    manualPayments.length,
    dailyCovers.length,
    receiptArchives.length,
  ]);

  return (
    <div className="space-y-6">
      {/* Section Header & Search Bar (Sub-section navigation is controlled via the right sidebar menu) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                میز کار خزانه‌داری: {activeSubTabMeta.title}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono-num font-bold border ${activeSubTabMeta.badgeClass}`}
              >
                {activeSubTabMeta.count.toLocaleString('fa-IR')} مورد
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{activeSubTabMeta.subtitle}</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در کد، ذینفع، شبا، شماره حساب، بانک (/)..."
              className="w-full pr-10 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>
        </div>

        {/* =====================================================================
            1. WAITING QUEUE (Pending_Treasury)
        ===================================================================== */}
        {subTab === 'QUEUE' && (
          <div className="pt-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAllQueue}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>
                    {selectedQueueUids.length === sortedQueue.length && sortedQueue.length > 0
                      ? 'لغو انتخاب همه'
                      : 'انتخاب همه موارد'}
                  </span>
                </button>
                <span className="text-xs text-slate-700">
                  انتخاب شده:{' '}
                  <strong className="font-mono-num text-slate-950">
                    {selectedQueueUids.length.toLocaleString('fa-IR')}
                  </strong>{' '}
                  سند · جمع مانده قابل پرداخت:{' '}
                  <strong className="font-mono-num text-slate-950 font-bold">
                    {formatRial(selectedQueueSum)} ریال
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={selectedQueueObjects.length === 0 || isMovingPool}
                  onClick={() => handleExportQueueAndMoveToInPayment(selectedQueueObjects)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedQueueObjects.length > 0 && !isMovingPool
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                  title="دانلود فایل اکسل با تمامی ستون‌های فرم‌ها و انتقال خودکار موارد انتخابی به مخزن در حال پرداخت"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    خروجی اکسل کامل و انتقال به «در حال پرداخت» (
                    {selectedQueueObjects.length.toLocaleString('fa-IR')} سند)
                  </span>
                </button>

                <button
                  type="button"
                  disabled={selectedQueueObjects.length === 0}
                  onClick={() =>
                    handleExportExcelOnly(
                      selectedQueueObjects,
                      'treasury-queue-selected',
                      'لیست انتخابی صف انتظار خزانه'
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    selectedQueueObjects.length > 0
                      ? 'bg-white border-emerald-600 text-emerald-800 hover:bg-emerald-50 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>فقط خروجی اکسل</span>
                </button>

                <button
                  type="button"
                  disabled={selectedQueueObjects.length === 0 || isMovingPool}
                  onClick={() => handleMoveItemsBetweenPools(selectedQueueObjects, 'IN_PAYMENT')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    selectedQueueObjects.length > 0 && !isMovingPool
                      ? 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>انتقال به مخزن در حال پرداخت</span>
                </button>

                <button
                  type="button"
                  disabled={selectedQueueObjects.length === 0}
                  onClick={() => openPaymentModal(selectedQueueObjects)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedQueueObjects.length > 0
                      ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  ثبت پرداخت گروهی ({selectedQueueObjects.length.toLocaleString('fa-IR')} سند)
                </button>
              </div>
            </div>

            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2.5 border-b border-slate-200 bg-slate-50/90 w-9 text-center">
                      #
                    </th>
                    <SortableHeader
                      label="کد رهگیری"
                      field="trackingCode"
                      type="text"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <SortableHeader
                      label="نوع فرم"
                      field="typeLabel"
                      type="text"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <SortableHeader
                      label="عنوان و شرح"
                      field="title"
                      type="text"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <SortableHeader
                      label="ذینفع / گیرنده وجه"
                      field="payeeName"
                      type="text"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <SortableHeader
                      label="واحد / مرکز هزینه"
                      field="costCenter"
                      type="text"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      بانک مقصد، کارت و شبا
                    </th>
                    <SortableHeader
                      label="مبلغ قابل پرداخت (ریال)"
                      field="remainingAmount"
                      type="numeric"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <SortableHeader
                      label="سررسید"
                      field="dueDate"
                      type="jalali_date"
                      sortConfig={queueSort}
                      onSort={handleQueueSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      عملیات خزانه
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedQueue.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        هیچ موردی در صف انتظار پرداخت خزانه وجود ندارد.
                      </td>
                    </tr>
                  ) : (
                    sortedQueue.map((item) => {
                      const checked = selectedQueueUids.includes(item.uid);
                      return (
                        <tr
                          key={item.uid}
                          className={`hover:bg-slate-50 transition-colors ${
                            checked ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectQueueItem(item.uid)}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 cursor-pointer"
                            />
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">
                            {item.trackingCode}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[11px]">
                              {item.typeLabel}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-900 font-medium break-words">
                            <div>{item.title}</div>
                            <div className="text-[11px] text-slate-500 break-words">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-800 font-semibold break-words">
                            {item.payeeName}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div>{item.department}</div>
                            <div className="text-[11px] text-slate-500">{item.costCenter}</div>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div className="font-semibold text-slate-900">
                              {item.destinationBank}
                            </div>
                            <div className="text-[11px] font-mono-num text-slate-600 break-all">
                              کارت/حساب: {item.accountOrCard}
                            </div>
                            <div className="text-[10px] font-mono-num text-slate-500 break-all">
                              شبا: {item.iban}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-950">
                            <div>{formatRial(item.remainingAmount ?? item.amount)}</div>
                            {item.paidAmountSoFar > 0 && (
                              <div className="text-[10px] text-emerald-700 font-normal">
                                پرداخت‌شده قبلی: {formatRial(item.paidAmountSoFar)}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num text-slate-700">
                            <div>{item.dueDate}</div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold ${getPriorityBadgeClasses(
                                item.priority
                              )}`}
                            >
                              {getPriorityLabel(item.priority)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailModalItem(item)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                title="مشاهده تمامی ستون‌ها و جزئیات فرم"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemsBetweenPools([item], 'IN_PAYMENT')}
                                className="px-2 py-1 text-[11px] font-semibold bg-purple-100 hover:bg-purple-200 text-purple-900 rounded cursor-pointer"
                                title="انتقال به مخزن در حال پرداخت"
                              >
                                به در حال پرداخت
                              </button>
                              <button
                                type="button"
                                onClick={() => openPaymentModal([item])}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded cursor-pointer"
                              >
                                ثبت پرداخت
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            2. IN-PAYMENT POOL (In_Payment)
        ===================================================================== */}
        {subTab === 'IN_PAYMENT' && (
          <div className="pt-4 space-y-4">
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-purple-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <span>
                    مخزن درخواست‌های «در حال پرداخت» (خروجی گرفته شده و در دست اقدام بانک)
                  </span>
                </div>
                <p className="text-[11px] text-purple-800">
                  این موارد از صف انتظار خارج شده‌اند تا خزانه‌دار پس از انجام پرداخت بانکی، با انتخاب حساب بانکی مبدأ تعریف‌شده، پرداخت تکی یا گروهی آن‌ها را نهایی کند.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllInPayment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-purple-300 hover:bg-purple-100 rounded-md cursor-pointer text-purple-950"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>
                    {selectedInPaymentUids.length === sortedInPayment.length &&
                    sortedInPayment.length > 0
                      ? 'لغو انتخاب همه'
                      : 'انتخاب همه در حال پرداخت‌ها'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={selectedInPaymentObjects.length === 0}
                  onClick={() =>
                    handleExportExcelOnly(
                      selectedInPaymentObjects,
                      'treasury-in-payment-pool',
                      'لیست مخزن در حال پرداخت خزانه'
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    selectedInPaymentObjects.length > 0
                      ? 'bg-white border-emerald-600 text-emerald-800 hover:bg-emerald-50'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>خروجی اکسل مجدد ({selectedInPaymentObjects.length})</span>
                </button>

                <button
                  type="button"
                  disabled={selectedInPaymentObjects.length === 0 || isMovingPool}
                  onClick={() => handleMoveItemsBetweenPools(selectedInPaymentObjects, 'QUEUE')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    selectedInPaymentObjects.length > 0 && !isMovingPool
                      ? 'bg-white border-amber-400 text-amber-900 hover:bg-amber-50 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازگردانی به صف انتظار ({selectedInPaymentObjects.length})</span>
                </button>

                <button
                  type="button"
                  disabled={selectedInPaymentObjects.length === 0}
                  onClick={() => openPaymentModal(selectedInPaymentObjects)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    selectedInPaymentObjects.length > 0
                      ? 'bg-purple-900 text-white hover:bg-purple-800 cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  ثبت نهایی پرداخت گروهی ({selectedInPaymentObjects.length.toLocaleString('fa-IR')}{' '}
                  سند — {formatRial(selectedInPaymentSum)} ریال)
                </button>
              </div>
            </div>

            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2.5 border-b border-slate-200 bg-slate-50/90 w-9 text-center">
                      #
                    </th>
                    <SortableHeader
                      label="کد رهگیری"
                      field="trackingCode"
                      type="text"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <SortableHeader
                      label="نوع فرم"
                      field="typeLabel"
                      type="text"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <SortableHeader
                      label="عنوان و شرح"
                      field="title"
                      type="text"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <SortableHeader
                      label="ذینفع / گیرنده وجه"
                      field="payeeName"
                      type="text"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <SortableHeader
                      label="مرکز هزینه"
                      field="costCenter"
                      type="text"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      بانک مقصد، شماره کارت و شبا
                    </th>
                    <SortableHeader
                      label="مانده قابل پرداخت (ریال)"
                      field="remainingAmount"
                      type="numeric"
                      sortConfig={inPaySort}
                      onSort={handleInPaySort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      زمان ورود به مخزن
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      عملیات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedInPayment.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        در حال حاضر هیچ درخواستی در «مخزن در حال پرداخت» قرار ندارد.
                      </td>
                    </tr>
                  ) : (
                    sortedInPayment.map((item) => {
                      const checked = selectedInPaymentUids.includes(item.uid);
                      return (
                        <tr
                          key={item.uid}
                          className={`hover:bg-purple-50/30 transition-colors ${
                            checked ? 'bg-purple-50/70' : ''
                          }`}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectInPaymentItem(item.uid)}
                              className="w-4 h-4 rounded border-slate-300 text-purple-900 cursor-pointer"
                            />
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">
                            {item.trackingCode}
                          </td>
                          <td className="px-2.5 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-semibold text-[11px]">
                              {item.typeLabel}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-900 font-medium break-words">
                            <div>{item.title}</div>
                            <div className="text-[11px] text-slate-500 break-words">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-800 font-semibold break-words">
                            {item.payeeName}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div>{item.department}</div>
                            <div className="text-[11px] text-slate-500">{item.costCenter}</div>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div className="font-semibold text-slate-900">
                              {item.destinationBank}
                            </div>
                            <div className="text-[11px] font-mono-num text-slate-600 break-all">
                              کارت/حساب: {item.accountOrCard}
                            </div>
                            <div className="text-[10px] font-mono-num text-slate-500 break-all">
                              شبا: {item.iban}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-purple-950">
                            <div>{formatRial(item.remainingAmount ?? item.amount)}</div>
                            {item.paidAmountSoFar > 0 && (
                              <div className="text-[10px] text-emerald-700 font-normal">
                                پرداخت‌شده قبلی: {formatRial(item.paidAmountSoFar)} (از کل{' '}
                                {formatRial(item.amount)})
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num text-slate-600 break-words">
                            <div>{item.inPaymentAt || 'هم‌اکنون'}</div>
                            <div className="text-[10px] text-slate-500">
                              {item.inPaymentBy || currentUser.name}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailModalItem(item)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                title="مشاهده کامل اطلاعات فرم"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemsBetweenPools([item], 'QUEUE')}
                                className="px-2 py-1 text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded cursor-pointer"
                                title="برگشت به صف انتظار"
                              >
                                به صف انتظار
                              </button>
                              <button
                                type="button"
                                onClick={() => openPaymentModal([item])}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer"
                              >
                                ثبت پرداخت قطعی
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            3. COMPLETED PAYMENTS (Paid + Manual Payments)
        ===================================================================== */}
        {subTab === 'COMPLETED' && (
          <div className="pt-4 space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>بخش کلیه پرداختی‌های انجام‌شده (آرشیو جامع تراکنش‌های تسویه‌شده)</span>
                </div>
                <div className="text-[11px] text-emerald-800 flex flex-wrap items-center gap-4">
                  <span>
                    تعداد کل اسناد تسویه‌شده:{' '}
                    <strong className="font-mono-num">{sortedCompleted.length}</strong> سند
                  </span>
                  <span>
                    جمع کل مبالغ پرداخت‌شده در این فیلتر:{' '}
                    <strong className="font-mono-num text-emerald-950 font-bold">
                      {formatRial(sortedCompleted.reduce((acc, i) => acc + i.amount, 0))} ریال
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={completedTypeFilter}
                  onChange={(e) => setCompletedTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="ALL">همه انواع پرداخت</option>
                  <option value="PAYMENT">دستور پرداخت تکی</option>
                  <option value="BATCH">پرداخت تجمیعی / گروهی</option>
                  <option value="ADVANCE">مساعده حقوق</option>
                  <option value="MANUAL">پرداخت تلفنی / کاغذی</option>
                </select>

                <select
                  value={completedSourceAccountFilter}
                  onChange={(e) => setCompletedSourceAccountFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="ALL">همه حساب‌های مبدأ شرکت</option>
                  {companyBankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} — {acc.accountTitle} ({acc.accountNumber})
                    </option>
                  ))}
                </select>

                <select
                  value={completedBankFilter}
                  onChange={(e) => setCompletedBankFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="ALL">همه بانک‌های مبدأ</option>
                  {SYSTEM_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    handleExportExcelOnly(
                      selectedCompletedObjects.length > 0
                        ? selectedCompletedObjects
                        : sortedCompleted,
                      'treasury-completed-payments',
                      'گزارش کلیه پرداختی‌های انجام‌شده خزانه‌داری'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    خروجی اکسل کامل پرداختی‌های انجام‌شده (
                    {selectedCompletedObjects.length > 0
                      ? `${selectedCompletedObjects.length} انتخابی`
                      : `همه ${sortedCompleted.length} مورد`}
                    )
                  </span>
                </button>
              </div>
            </div>

            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2.5 border-b border-slate-200 bg-slate-50/90 w-9 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedCompletedUids.length === sortedCompleted.length &&
                          sortedCompleted.length > 0
                        }
                        onChange={toggleSelectAllCompleted}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                      />
                    </th>
                    <SortableHeader
                      label="کد رهگیری"
                      field="trackingCode"
                      type="text"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <SortableHeader
                      label="نوع پرداخت"
                      field="typeLabel"
                      type="text"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <SortableHeader
                      label="عنوان و شرح"
                      field="title"
                      type="text"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <SortableHeader
                      label="ذینفع / گیرنده وجه"
                      field="payeeName"
                      type="text"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      مشخصات حساب مقصد (ذینفع)
                    </th>
                    <SortableHeader
                      label="مبلغ پرداخت‌شده (ریال)"
                      field="amount"
                      type="numeric"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      حساب بانکی مبدأ (تصویر ثابت زمان پرداخت)
                    </th>
                    <SortableHeader
                      label="شماره مرجع بانکی"
                      field="bankRefNumber"
                      type="text"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <SortableHeader
                      label="تاریخ تسویه"
                      field="paidDateJalali"
                      type="jalali_date"
                      sortConfig={completedSort}
                      onSort={handleCompletedSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      فیش و جزئیات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedCompleted.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                        هیچ پرداخت انجام‌شده‌ای با این فیلتر یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    sortedCompleted.map((item) => {
                      const checked = selectedCompletedUids.includes(item.uid);
                      const matchedReceipt = receiptArchives.find(
                        (r) =>
                          r.relatedPaymentIds.includes(item.id) ||
                          r.relatedTrackingCodes.includes(item.trackingCode)
                      );
                      const snap = item.sourceAccountSnapshot;
                      return (
                        <tr
                          key={item.uid}
                          className={`hover:bg-emerald-50/30 transition-colors ${
                            checked ? 'bg-emerald-50/70' : ''
                          }`}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectCompletedItem(item.uid)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                            />
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">
                            {item.trackingCode}
                          </td>
                          <td className="px-2.5 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[11px]">
                              {item.typeLabel}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-900 font-medium break-words">
                            <div>{item.title}</div>
                            <div className="text-[11px] text-slate-500 break-words">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-800 font-semibold break-words">
                            {item.payeeName}
                          </td>
                          <td className="px-2.5 py-2.5 text-slate-700 break-words">
                            <div className="font-semibold text-slate-900">
                              {item.destinationBank}
                            </div>
                            <div className="text-[11px] font-mono-num text-slate-600 break-all">
                              کارت/حساب: {item.accountOrCard}
                            </div>
                            <div className="text-[10px] font-mono-num text-slate-500 break-all">
                              شبا: {item.iban}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-emerald-800">
                            {formatRial(item.amount)}
                          </td>
                          <td className="px-2.5 py-2.5 break-words">
                            <div className="font-bold text-slate-900">
                              {snap?.bankName || item.paidBankName || '—'}
                              {snap?.accountTitle ? ` — ${snap.accountTitle}` : ''}
                            </div>
                            {snap?.accountNumber && (
                              <div className="text-[11px] font-mono-num text-slate-700 break-all">
                                حساب مبدأ: {snap.accountNumber}
                              </div>
                            )}
                            {snap?.iban && (
                              <div
                                className="text-[10px] font-mono-num text-slate-500 break-all"
                                dir="ltr"
                              >
                                {snap.iban}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-800 break-all">
                            {item.bankRefNumber}
                          </td>
                          <td className="px-2.5 py-2.5 font-mono-num text-slate-600">
                            {item.paidDateJalali}
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailModalItem(item)}
                                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer flex items-center gap-1"
                              >
                                <Info className="w-3.5 h-3.5" />
                                <span>فرم کامل</span>
                              </button>
                              {matchedReceipt && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReceiptModal(matchedReceipt)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>فیش</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            4. COMPANY SOURCE BANK ACCOUNTS (بانک‌ها و شماره‌حساب‌ها)
        ===================================================================== */}
        {subTab === 'BANK_ACCOUNTS' && (
          <div className="pt-4 space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <span>مدیریت حساب‌های بانکی مبدأ پرداخت شرکت</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  در این بخش، حساب‌های بانکی مبدأ شرکت (حسابی که خزانه از آن وجه را پرداخت می‌کند) تعریف و مدیریت می‌شوند. برای حفظ یکپارچگی اسناد مالی، حساب‌های استفاده‌شده در سوابق پرداخت به جای حذف فیزیکی، غیرفعال می‌شوند و تصویر ثابت مشخصات حساب در زمان پرداخت روی هر تراکنش قبلی محفوظ می‌ماند.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={bankAccountStatusFilter}
                  onChange={(e) =>
                    setBankAccountStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                  }
                  className="px-3 py-1.5 text-xs bg-white border border-blue-300 rounded-lg font-semibold text-slate-800"
                >
                  <option value="ALL">همه حساب‌ها ({companyBankAccounts.length})</option>
                  <option value="ACTIVE">
                    فقط حساب‌های فعال ({companyBankAccounts.filter((a) => a.isActive).length})
                  </option>
                  <option value="INACTIVE">
                    حساب‌های غیرفعال ({companyBankAccounts.filter((a) => !a.isActive).length})
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => openBankAccountCreateModal('TAB')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>افزودن حساب بانکی مبدأ جدید</span>
                </button>
                <button type="button" disabled={currentUser.role!=='ADMIN'&&!currentUser.effectivePermissions?.canManageBankAccounts} onClick={()=>setShowBankImport(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white hover:bg-blue-50 border border-blue-300 text-blue-800 rounded-lg cursor-pointer disabled:opacity-50"><FileSpreadsheet className="w-4 h-4" />ورود گروهی از اکسل</button>
              </div>
            </div>

            <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <SortableHeader
                      label="نام بانک و شعبه"
                      field="bankName"
                      type="text"
                      sortConfig={bankAccSort}
                      onSort={handleBankAccSort}
                    />
                    <SortableHeader
                      label="عنوان حساب و شرکت"
                      field="accountTitle"
                      type="text"
                      sortConfig={bankAccSort}
                      onSort={handleBankAccSort}
                    />
                    <SortableHeader
                      label="شماره حساب (با حفظ صفر ابتدایی)"
                      field="accountNumber"
                      type="text"
                      sortConfig={bankAccSort}
                      onSort={handleBankAccSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      شماره شبا (IBAN) و کارت
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      نوع حساب و روش‌های مجاز
                    </th>
                    <th className="px-2.5 py-2.5 text-center font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      وضعیت حساب
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      عملیات مدیریت
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedBankAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        هیچ حساب بانکی مبدأی مطابق با جست‌وجو یا فیلتر شما یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    sortedBankAccounts.map((acc) => (
                      <tr
                        key={acc.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          !acc.isActive ? 'bg-slate-50/60 opacity-75' : ''
                        }`}
                      >
                        <td className="px-2.5 py-2.5 break-words">
                          <div className="font-bold text-slate-950 flex flex-wrap items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{acc.bankName}</span>
                            {acc.isDefault && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>پیش‌فرض</span>
                              </span>
                            )}
                          </div>
                          {(acc.branchName || acc.branchCode) && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              شعبه: {acc.branchName || '—'}
                              {acc.branchCode ? ` (کد ${acc.branchCode})` : ''}
                            </div>
                          )}
                        </td>

                        <td className="px-2.5 py-2.5 break-words">
                          <div className="font-bold text-slate-900">{acc.accountTitle}</div>
                          <div className="text-[11px] text-slate-500">{acc.companyName}</div>
                        </td>

                        <td className="px-2.5 py-2.5">
                          <span
                            dir="ltr"
                            className="font-mono-num font-bold text-slate-950 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-xs inline-block break-all"
                          >
                            {acc.accountNumber}
                          </span>
                        </td>

                        <td className="px-2.5 py-2.5 break-all">
                          {acc.iban ? (
                            <div
                              dir="ltr"
                              className="font-mono-num font-semibold text-slate-800 text-[11px]"
                            >
                              {acc.iban}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">شبا ثبت نشده</div>
                          )}
                          {acc.cardNumber && (
                            <div
                              dir="ltr"
                              className="font-mono-num text-[10px] text-slate-500 mt-0.5"
                            >
                              کارت: {acc.cardNumber}
                            </div>
                          )}
                        </td>

                        <td className="px-2.5 py-2.5">
                          <div className="font-semibold text-slate-800">{acc.accountType}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(acc.allowedPaymentMethods || []).map((m) => (
                              <span
                                key={m}
                                className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]"
                              >
                                {m === 'PAYA'
                                  ? 'پایا'
                                  : m === 'SATNA'
                                  ? 'ساتنا'
                                  : m === 'CARD'
                                  ? 'کارت'
                                  : m === 'INTERNAL'
                                  ? 'داخلی'
                                  : 'چک'}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-2.5 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              acc.isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {acc.isActive ? 'فعال و مجاز برای پرداخت' : 'غیرفعال (بایگانی)'}
                          </span>
                        </td>

                        <td className="px-2.5 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openBankAccountEditModal(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>

                            {acc.isActive && !acc.isDefault && (
                              <button
                                type="button"
                                onClick={() => onSetDefaultBankAccount({ accountId: acc.id })}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded cursor-pointer"
                                title="تنظیم به‌عنوان حساب پیش‌فرض پرداخت"
                              >
                                <Star className="w-3 h-3" />
                                <span>پیش‌فرض</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onToggleBankAccountStatus({
                                  accountId: acc.id,
                                  isActive: !acc.isActive,
                                })
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer border ${
                                acc.isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                              <span>{acc.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی مجدد'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            5. MANUAL / PHONE PAYMENTS
        ===================================================================== */}
        {subTab === 'MANUAL' && (
          <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleManualSubmit}
              className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5"
            >
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-slate-700" />
                <span>ثبت پرداخت خارج از نوبت (دستور تلفنی یا کاغذی)</span>
              </h3>

              {manualError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ذینفع / گیرنده وجه <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualPayee}
                  onChange={(e) => setManualPayee(e.target.value)}
                  placeholder="نام شخص یا شرکت گیرنده..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مبلغ پرداختی (ریال) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاریخ پرداخت (شمسی)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <SourceBankAccountSelector
                  accounts={companyBankAccounts}
                  selectedAccountId={manualSourceAccountId}
                  onSelectAccount={(acc) => setManualSourceAccountId(acc ? acc.id : '')}
                  onOpenQuickCreate={() => openBankAccountCreateModal('MANUAL_FORM')}
                  label="انتخاب حساب بانکی مبدأ پرداخت شرکت"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    شماره پیگیری / مرجع بانکی <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualRefNo}
                    onChange={(e) => setManualRefNo(e.target.value)}
                    placeholder="مثلاً 8810293844"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مرجع دستور (تلفنی / کاغذی)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualOrderedBy}
                    onChange={(e) => setManualOrderedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  بابت / شرح دستور پرداخت
                </label>
                <input
                  type="text"
                  required
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="توضیحات پرداخت فوری..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  بارگذاری فایل فیش بانکی (الزامی یا صدور سیستمی)
                </label>
                <label className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-white border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{manualReceiptName || 'انتخاب تصویر فیش واریزی'}</span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    onChange={(e) => handleReceiptFileChange(e, 'MANUAL')}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSavingManual}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isSavingManual ? 'در حال ثبت...' : 'ثبت پرداخت دستی و صدور فیش در بایگانی'}
              </button>
            </form>

            <div className="lg:col-span-7 w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <SortableHeader
                      label="کد سند"
                      field="trackingCode"
                      type="text"
                      sortConfig={manualSort}
                      onSort={handleManualSort}
                    />
                    <SortableHeader
                      label="ذینفع"
                      field="payee"
                      type="text"
                      sortConfig={manualSort}
                      onSort={handleManualSort}
                    />
                    <SortableHeader
                      label="مبلغ (ریال)"
                      field="amount"
                      type="numeric"
                      sortConfig={manualSort}
                      onSort={handleManualSort}
                    />
                    <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                      حساب بانکی مبدأ پرداخت
                    </th>
                    <SortableHeader
                      label="دستوردهنده"
                      field="orderedBy"
                      type="text"
                      sortConfig={manualSort}
                      onSort={handleManualSort}
                    />
                    <SortableHeader
                      label="تاریخ"
                      field="date"
                      type="jalali_date"
                      sortConfig={manualSort}
                      onSort={handleManualSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedManual.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">
                        {m.trackingCode}
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold text-slate-800 break-words">
                        <div>{m.payee}</div>
                        <div className="text-[11px] text-slate-500 font-normal break-words">
                          {m.description}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-950">
                        {formatRial(m.amount)}
                      </td>
                      <td className="px-2.5 py-2.5 text-slate-700 break-words">
                        <div className="font-bold text-slate-900">
                          {m.sourceAccountSnapshot?.bankName || m.bankName}
                          {m.sourceAccountSnapshot?.accountTitle
                            ? ` — ${m.sourceAccountSnapshot.accountTitle}`
                            : ''}
                        </div>
                        {m.sourceAccountSnapshot?.accountNumber && (
                          <div className="text-[10px] font-mono-num text-slate-500 break-all">
                            حساب: {m.sourceAccountSnapshot.accountNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 text-slate-700 break-words">{m.orderedBy}</td>
                      <td className="px-2.5 py-2.5 font-mono-num text-slate-600">
                        {m.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            6. DAILY COVERS
        ===================================================================== */}
        {subTab === 'COVER' && (
          <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleConfirmCloseCover}
              className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5"
            >
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <span>بستن روکش روزانه تراکنش‌های خزانه</span>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاریخ روکش (شمسی)
                  </label>
                  <input
                    type="text"
                    value={coverDate}
                    onChange={(e) => setCoverDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تفکیک بانک مبدأ
                  </label>
                  <select
                    value={coverBankName}
                    onChange={(e) => setCoverBankName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="کلیه بانک‌ها">کلیه بانک‌ها</option>
                    {SYSTEM_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    جمع ورودی‌های روز (ریال)
                  </label>
                  <input
                    type="number"
                    value={coverTotalIn}
                    onChange={(e) => setCoverTotalIn(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    کارمزد بانکی پایا/ساتنا (ریال)
                  </label>
                  <input
                    type="number"
                    value={coverBankFee}
                    onChange={(e) => setCoverBankFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>جمع پرداخت‌های سیستمی و گروهی روز:</span>
                  <strong className="font-mono-num text-slate-900">
                    {formatRial(
                      todayCoverTransactions.sumAdv +
                        todayCoverTransactions.sumPay +
                        todayCoverTransactions.sumBat
                    )}{' '}
                    ریال
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>جمع پرداخت‌های تلفنی و دستی روز:</span>
                  <strong className="font-mono-num text-slate-900">
                    {formatRial(todayCoverTransactions.sumMan)} ریال
                  </strong>
                </div>
                <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-200">
                  <span>جمع کل خروجی روز (با کارمزد):</span>
                  <span className="font-mono-num text-rose-700">
                    {formatRial(todayCoverTransactions.totalOutNum)} ریال
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  توضیحات بستن روکش
                </label>
                <input
                  type="text"
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={isClosingCover}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isClosingCover ? 'در حال قفل و ثبت روکش...' : 'تایید و بستن قطعی روکش روزانه'}
              </button>
            </form>

            <div className="lg:col-span-7 w-full border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full table-auto text-right border-collapse text-xs">
                <thead>
                  <tr>
                    <SortableHeader
                      label="شماره روکش"
                      field="coverNumber"
                      type="text"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                    <SortableHeader
                      label="تاریخ"
                      field="date"
                      type="jalali_date"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                    <SortableHeader
                      label="بانک مبدأ"
                      field="bankName"
                      type="text"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                    <SortableHeader
                      label="جمع ورودی (ریال)"
                      field="totalIn"
                      type="numeric"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                    <SortableHeader
                      label="جمع خروجی (ریال)"
                      field="totalOut"
                      type="numeric"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                    <SortableHeader
                      label="وضعیت"
                      field="status"
                      type="status"
                      sortConfig={coverSort}
                      onSort={handleCoverSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedCovers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-words">
                        {c.coverNumber}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono-num text-slate-700">
                        {c.date}
                      </td>
                      <td className="px-2.5 py-2.5 text-slate-800 font-medium break-words">
                        {c.bankName}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono-num text-emerald-700 font-semibold">
                        {formatRial(c.totalIn)}
                      </td>
                      <td className="px-2.5 py-2.5 font-mono-num text-rose-700 font-bold">
                        {formatRial(c.totalOut)}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeClasses(
                            c.status
                          )}`}
                        >
                          {getStatusLabel(c.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            7. RECEIPT ARCHIVE (FOLDER BY DAY + TABLE VIEW)
        ===================================================================== */}
        {subTab === 'ARCHIVE' && (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                تمامی فیش‌های بانکی به صورت خودکار در{' '}
                <strong className="text-slate-900">پوشه روز پرداخت</strong> بایگانی می‌شوند.
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setArchiveViewMode('FOLDERS')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                    archiveViewMode === 'FOLDERS'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>نمایش پوشه‌های روز ({dayFolders.length} روز)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveViewMode('TABLE')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                    archiveViewMode === 'TABLE'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>جدول یکپارچه ({sortedReceipts.length})</span>
                </button>
              </div>
            </div>

            {archiveViewMode === 'FOLDERS' && (
              <div className="space-y-3">
                {dayFolders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    هنوز فیش پرداختی برای نمایش در پوشه‌ها ثبت نشده است.
                  </div>
                ) : (
                  dayFolders.map((folder) => {
                    const isExpanded = expandedFolders.includes(folder.day);
                    return (
                      <div
                        key={folder.day}
                        className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                      >
                        <div
                          onClick={() => toggleFolderExpand(folder.day)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition cursor-pointer gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            {isExpanded ? (
                              <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                            ) : (
                              <Folder className="w-5 h-5 text-amber-600 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                <span>پوشه تسویه و پرداخت روز:</span>
                                <span className="font-mono-num text-slate-950 font-bold px-2 py-0.5 bg-white border border-slate-300 rounded">
                                  {folder.day}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                شامل {folder.receipts.length} سند پرداختی قطعی
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mr-auto sm:mr-0">
                            <div className="text-right">
                              <span className="text-[11px] text-slate-500 block">
                                جمع پرداخت‌های پوشه:
                              </span>
                              <span className="text-xs font-bold font-mono-num text-emerald-700">
                                {formatRial(folder.totalAmount)} ریال
                              </span>
                            </div>
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-200 p-2 w-full overflow-hidden">
                            <table className="w-full table-auto text-right border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/60">
                                  <th className="px-2.5 py-2 font-semibold text-slate-700">
                                    شماره مرجع / پیگیری
                                  </th>
                                  <th className="px-2.5 py-2 font-semibold text-slate-700">نوع سند</th>
                                  <th className="px-2.5 py-2 font-semibold text-slate-700">
                                    حساب بانکی مبدأ پرداخت
                                  </th>
                                  <th className="px-2.5 py-2 font-semibold text-slate-700">
                                    مبلغ پرداختی (ریال)
                                  </th>
                                  <th className="px-2.5 py-2 font-semibold text-slate-700">
                                    ساعت و ثبت‌کننده
                                  </th>
                                  <th className="px-2.5 py-2 text-center font-semibold text-slate-700">
                                    مشاهده فیش
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {folder.receipts.map((r) => (
                                  <tr key={r.id} className="hover:bg-slate-50/70">
                                    <td className="px-2.5 py-2 font-mono-num font-bold text-slate-900 break-all">
                                      {r.bankRefNumber}
                                    </td>
                                    <td className="px-2.5 py-2 text-slate-700">
                                      {r.paymentType === 'BATCH'
                                        ? 'پرداخت گروهی'
                                        : r.paymentType === 'ADVANCE'
                                        ? 'مساعده حقوق'
                                        : 'دستور پرداخت'}
                                    </td>
                                    <td className="px-2.5 py-2 text-slate-800 font-medium break-words">
                                      <div className="font-bold">
                                        {r.sourceAccountSnapshot?.bankName || r.bankName}
                                        {r.sourceAccountSnapshot?.accountTitle
                                          ? ` — ${r.sourceAccountSnapshot.accountTitle}`
                                          : ''}
                                      </div>
                                      {r.sourceAccountSnapshot?.accountNumber && (
                                        <div className="text-[10px] font-mono-num text-slate-500 break-all">
                                          شماره حساب: {r.sourceAccountSnapshot.accountNumber}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-2.5 py-2 font-mono-num font-bold text-emerald-800">
                                      {formatRial(r.amount)}
                                    </td>
                                    <td className="px-2.5 py-2 font-mono-num text-slate-500">
                                      {r.uploadedAt}
                                    </td>
                                    <td className="px-2.5 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => onOpenReceiptModal(r)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>مشاهده فیش</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {archiveViewMode === 'TABLE' && (
              <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full table-auto text-right border-collapse text-xs">
                  <thead>
                    <tr>
                      <SortableHeader
                        label="شماره مرجع"
                        field="bankRefNumber"
                        type="text"
                        sortConfig={receiptSort}
                        onSort={handleReceiptSort}
                      />
                      <SortableHeader
                        label="نوع سند"
                        field="paymentType"
                        type="text"
                        sortConfig={receiptSort}
                        onSort={handleReceiptSort}
                      />
                      <SortableHeader
                        label="مبلغ فیش (ریال)"
                        field="amount"
                        type="numeric"
                        sortConfig={receiptSort}
                        onSort={handleReceiptSort}
                      />
                      <SortableHeader
                        label="حساب بانکی مبدأ"
                        field="bankName"
                        type="text"
                        sortConfig={receiptSort}
                        onSort={handleReceiptSort}
                      />
                      <SortableHeader
                        label="زمان ثبت"
                        field="uploadedAt"
                        type="text"
                        sortConfig={receiptSort}
                        onSort={handleReceiptSort}
                      />
                      <th className="px-2.5 py-2.5 text-right font-semibold text-slate-700 border-b border-slate-200 bg-slate-50/90">
                        مشاهده فیش
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-900 break-all">
                          {r.bankRefNumber}
                        </td>
                        <td className="px-2.5 py-2.5 text-slate-700">
                          {r.paymentType}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono-num font-bold text-slate-950">
                          {formatRial(r.amount)}
                        </td>
                        <td className="px-2.5 py-2.5 text-slate-700 break-words">
                          <div className="font-bold text-slate-900">
                            {r.sourceAccountSnapshot?.bankName || r.bankName}
                            {r.sourceAccountSnapshot?.accountTitle
                              ? ` — ${r.sourceAccountSnapshot.accountTitle}`
                              : ''}
                          </div>
                          {r.sourceAccountSnapshot?.accountNumber && (
                            <div className="text-[10px] font-mono-num text-slate-500 break-all">
                              حساب: {r.sourceAccountSnapshot.accountNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono-num text-slate-600">
                          {r.uploadedAt}
                        </td>
                        <td className="px-2.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => onOpenReceiptModal(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>پیش‌نمایش</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          Full Form & Batch Items Details Modal
      ===================================================================== */}
      {detailModalItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>اطلاعات کامل فرم درخواست و پرداخت — کد:</span>
                  <span className="font-mono-num bg-slate-100 px-2 py-0.5 rounded">
                    {detailModalItem.trackingCode}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  وضعیت فعلی: {getStatusLabel(detailModalItem.status)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleExportExcelOnly(
                      [detailModalItem],
                      `form-${detailModalItem.trackingCode}`,
                      'اطلاعات فرم'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>خروجی اکسل این فرم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">نوع درخواست:</span>
                <strong className="text-slate-900">{detailModalItem.typeLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">عنوان / موضوع:</span>
                <strong className="text-slate-900">{detailModalItem.title}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">ذینفع / گیرنده وجه:</span>
                <strong className="text-slate-900">{detailModalItem.payeeName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">واحد سازمانی:</span>
                <strong className="text-slate-900">{detailModalItem.department}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">مرکز هزینه:</span>
                <strong className="text-slate-900">{detailModalItem.costCenter}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">مبلغ مصوب کل:</span>
                <strong className="font-mono-num text-slate-950 font-bold text-sm">
                  {formatRial(detailModalItem.amount)} ریال
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">بانک مقصد (ذینفع):</span>
                <strong className="text-slate-900">{detailModalItem.destinationBank}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">شماره کارت / حساب مقصد:</span>
                <strong className="font-mono-num text-slate-900">
                  {detailModalItem.accountOrCard}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">شماره شبا مقصد (IBAN):</span>
                <strong className="font-mono-num text-slate-900">{detailModalItem.iban}</strong>
              </div>
              {detailModalItem.sourceAccountSnapshot && (
                <div className="sm:col-span-2 lg:col-span-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-blue-700 text-[11px] block">
                      بانک و عنوان حساب مبدأ شرکت:
                    </span>
                    <strong className="text-blue-950">
                      {detailModalItem.sourceAccountSnapshot.bankName} —{' '}
                      {detailModalItem.sourceAccountSnapshot.accountTitle}
                    </strong>
                  </div>
                  <div>
                    <span className="text-blue-700 text-[11px] block">شماره حساب مبدأ:</span>
                    <strong className="font-mono-num text-blue-950">
                      {detailModalItem.sourceAccountSnapshot.accountNumber}
                    </strong>
                  </div>
                  <div>
                    <span className="text-blue-700 text-[11px] block">شماره شبا مبدأ:</span>
                    <strong className="font-mono-num text-blue-950" dir="ltr">
                      {detailModalItem.sourceAccountSnapshot.iban || '—'}
                    </strong>
                  </div>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200">
                <span className="text-slate-500 block">شرح کامل فرم:</span>
                <p className="text-slate-900 font-medium mt-0.5">{detailModalItem.description}</p>
              </div>
            </div>

            <OfficialReviewNotes row={detailModalItem.rawPayment || detailModalItem.rawAdvance || detailModalItem.rawBatch}/>
            {detailModalItem.batchItems?.map(item=><div key={item.id}><OfficialReviewNotes row={item}/></div>)}
            {detailModalItem.paymentHistory && detailModalItem.paymentHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">
                  سوابق مراحل پرداخت این درخواست ({detailModalItem.paymentHistory.length} مرحله)
                </h4>
                <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full table-auto text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2.5 py-2">مرحله</th>
                        <th className="px-2.5 py-2">مبلغ پرداخت‌شده (ریال)</th>
                        <th className="px-2.5 py-2">حساب مبدأ شرکت</th>
                        <th className="px-2.5 py-2">شماره حساب مبدأ</th>
                        <th className="px-2.5 py-2">شماره پیگیری</th>
                        <th className="px-2.5 py-2">تاریخ و خزانه‌دار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailModalItem.paymentHistory.map((ph, idx) => (
                        <tr key={ph.id}>
                          <td className="px-2.5 py-2 font-mono-num">{idx + 1}</td>
                          <td className="px-2.5 py-2 font-mono-num font-bold text-emerald-800">
                            {formatRial(ph.amount)}
                          </td>
                          <td className="px-2.5 py-2 font-semibold text-slate-900 break-words">
                            {ph.sourceAccountSnapshot?.bankName || ph.paidBankName || '—'} —{' '}
                            {ph.sourceAccountSnapshot?.accountTitle || ''}
                          </td>
                          <td className="px-2.5 py-2 font-mono-num text-slate-800 break-all">
                            {ph.sourceAccountSnapshot?.accountNumber || '—'}
                          </td>
                          <td className="px-2.5 py-2 font-mono-num font-bold text-slate-900 break-all">
                            {ph.bankRefNumber || ph.trackingCode || '—'}
                          </td>
                          <td className="px-2.5 py-2 text-slate-600 break-words">
                            {ph.executedDateJalali || ph.paidDateJalali || ph.dateJalali || '—'} —{' '}
                            {ph.executedByUserName || ph.treasuryUserName || ph.executedByName || 'خزانه‌دار'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailModalItem.batchItems && detailModalItem.batchItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">
                  ریز اقلام و ذینفعان لیست تجمیعی ({detailModalItem.batchItems.length} ردیف)
                </h4>
                <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full table-auto text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2.5 py-2">ردیف</th>
                        <th className="px-2.5 py-2">ذینفع</th>
                        <th className="px-2.5 py-2">مرکز هزینه</th>
                        <th className="px-2.5 py-2">بانک مقصد</th>
                        <th className="px-2.5 py-2">شماره کارت / حساب</th>
                        <th className="px-2.5 py-2">شماره شبا</th>
                        <th className="px-2.5 py-2">مبلغ قابل پرداخت (ریال)</th>
                        <th className="px-2.5 py-2">شرح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailModalItem.batchItems.map((sub, idx) => (
                        <tr key={sub.id} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 font-mono-num">{idx + 1}</td>
                          <td className="px-2.5 py-2 font-bold text-slate-900 break-words">{sub.payeeName}</td>
                          <td className="px-2.5 py-2 text-slate-700 break-words">{sub.costCenter}</td>
                          <td className="px-2.5 py-2 text-slate-700 break-words">{sub.bankName}</td>
                          <td className="px-2.5 py-2 font-mono-num text-slate-800 break-all">
                            {sub.accountOrCard}
                          </td>
                          <td className="px-2.5 py-2 font-mono-num text-slate-600 break-all">{sub.iban}</td>
                          <td className="px-2.5 py-2 font-mono-num font-bold text-slate-950">
                            {formatRial(sub.approvedAmount ?? sub.amount)}
                          </td>
                          <td className="px-2.5 py-2 text-slate-600 break-words">{sub.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          Payment Execution Modal (With Source Bank Account Selector & Partial Payment)
      ===================================================================== */}
      {paymentModalItems && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  ثبت پرداخت انجام‌شده توسط خزانه ({paymentModalItems.length} سند)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  انتخاب حساب بانکی مبدأ پرداخت شرکت و ثبت شماره پیگیری و فیش بانکی
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={isPaying}
                aria-label="بستن فرم ثبت پرداخت"
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentModalError}</span>
              </div>
            )}
            {modalPending&&(
              <div role={recoveredReceipt?'status':'alert'} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 space-y-2">
                <p>{recoveredReceipt?`ثبت قبلی این عملیات در سرور تأیید شد؛ مبلغ ${formatRial(recoveredReceipt.amount)} ریال، مرجع ${recoveredReceipt.bankRefNumber}. این نتیجه مربوط به ثبت قبلی است؛ برای ثبت جدید ابتدا این پیام را ببندید.`:'نتیجه ثبت قبلی هنوز تأیید نشده است؛ شناسه پیگیری حفظ شده و تلاش دستی دوباره فقط با همان شناسه و اطلاعات امکان‌پذیر است. نبود نتیجه، به معنی عدم ثبت نیست.'}</p>
                <button type="button" disabled={isPaying} onClick={()=>void onRefreshState()} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg disabled:opacity-50">بررسی نتیجه از سرور</button>
              </div>
            )}

            <form onSubmit={handleConfirmPaymentExecution} className="space-y-4 text-xs">
              {paymentModalItems.length === 1 && paymentModalItems[0].type !== 'BATCH' ? (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">مبلغ مصوب کل:</span>
                      <strong className="font-mono-num text-slate-900">
                        {formatRial(paymentModalItems[0].amount)} ریال
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">پرداخت‌شده قبلی:</span>
                      <strong className="font-mono-num text-emerald-700">
                        {formatRial(paymentModalItems[0].paidAmountSoFar || 0)} ریال
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">مانده قابل پرداخت:</span>
                      <strong className="font-mono-num text-purple-900 font-bold">
                        {formatRial(
                          paymentModalItems[0].remainingAmount ?? paymentModalItems[0].amount
                        )}{' '}
                        ریال
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <label className="block font-bold text-slate-800 mb-1">
                      مبلغ پرداخت این نوبت (ریال) — امکان پرداخت کامل یا جزئی تا سقف مانده:
                    </label>
                    <input
                      type="text"
                      required
                      value={partialPaymentAmount}
                      onChange={(e) => setPartialPaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-950"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-slate-600">جمع کل مانده قابل پرداخت اسناد انتخابی:</div>
                  <div className="font-mono-num font-bold text-slate-950 text-base">
                    {formatRial(
                      paymentModalItems.reduce(
                        (acc, i) => acc + (i.remainingAmount ?? i.amount),
                        0
                      )
                    )}{' '}
                    ریال
                  </div>
                </div>
              )}

              {/* Searchable Company Source Bank Account Selector */}
              <SourceBankAccountSelector
                accounts={companyBankAccounts}
                selectedAccountId={selectedSourceAccountId}
                onSelectAccount={(acc) => setSelectedSourceAccountId(acc ? acc.id : '')}
                onOpenQuickCreate={() => openBankAccountCreateModal('PAYMENT_MODAL')}
                label="از کدام حساب بانکی شرکت پرداخت انجام شده است؟ (حساب مبدأ)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">روش پرداخت</label>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethodType)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    {ALL_PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    شماره مرجع / پیگیری بانکی <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankRefNumber}
                    onChange={(e) => setBankRefNumber(e.target.value)}
                    placeholder="مثلاً 9988224411"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    تاریخ پرداخت (شمسی)
                  </label>
                  <input
                    type="text"
                    required
                    value={execDateJalali}
                    onChange={(e) => setExecDateJalali(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  پیوست تصویر فیش بانکی
                </label>
                <label className="flex items-center justify-center p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-600">
                  <Upload className="w-4 h-4 ml-1.5" />
                  <span>
                    {uploadedReceiptName ||
                      'انتخاب فایل فیش بانکی (یا صدور رسید سیستمی با مشخصات حساب مبدأ)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    onChange={(e) => handleReceiptFileChange(e, 'MODAL')}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={isPaying}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isPaying || !selectedModalSourceAccount || !!recoveredReceipt}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg cursor-pointer"
                >
                  {isPaying
                    ? 'در حال ثبت...'
                    : 'تایید و ثبت پرداخت با حساب مبدأ انتخاب‌شده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          Add / Edit Company Source Bank Account Modal (Accessible from Tab or Payment Modal)
      ===================================================================== */}
      {showBankImport&&<BankAccountImportDialog onClose={closeBankImport} onImport={onImportBankAccounts} />}
      {showBankAccountModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingBankAccount
                      ? `ویرایش حساب بانکی مبدأ — ${editingBankAccount.accountTitle}`
                      : 'تعریف حساب بانکی مبدأ جدید برای خزانه'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    شماره حساب، شبا و کارت به‌صورت رشته‌ای با حفظ صفرهای ابتدایی و پشتیبانی از ارقام فارسی/انگلیسی ذخیره می‌شوند.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBankAccountModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bankAccountFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bankAccountFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBankAccountSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نام بانک <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    {SYSTEM_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    عنوان حساب مبدأ <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formAccountTitle}
                    onChange={(e) => setFormAccountTitle(e.target.value)}
                    placeholder="مثلاً: جاری عملیاتی خزانه مرکزی"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نام شرکت / صاحب حساب <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCompanyName}
                    onChange={(e) => setFormCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع حساب</label>
                  <select
                    value={formAccountType}
                    onChange={(e) =>
                      setFormAccountType(
                        e.target.value as 'جاری' | 'کوتاه‌مدت' | 'پشتیبان' | 'تنخواه'
                      )
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="جاری">جاری</option>
                    <option value="پشتیبان">پشتیبان</option>
                    <option value="تنخواه">تنخواه</option>
                    <option value="کوتاه‌مدت">کوتاه‌مدت</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    شماره حساب بانکی (حفظ صفر ابتدایی) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="0109482711004"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num text-left font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    شماره شبا (IBAN — ۲۶ کاراکتر با IR)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formIban}
                    onChange={(e) => setFormIban(e.target.value)}
                    placeholder="IR520120000000109482711004"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num text-left"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    شماره کارت متصل به حساب (۱۶ رقم اختیاری)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formCardNumber}
                    onChange={(e) => setFormCardNumber(e.target.value)}
                    placeholder="6104337890123456"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num text-left"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نام شعبه</label>
                    <input
                      type="text"
                      value={formBranchName}
                      onChange={(e) => setFormBranchName(e.target.value)}
                      placeholder="شعبه مرکزی"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">کد شعبه</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formBranchCode}
                      onChange={(e) => setFormBranchCode(e.target.value)}
                      placeholder="0214"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono-num text-left"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  روش‌های پرداخت مجاز روی این حساب:
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PAYMENT_METHODS.map((m) => {
                    const checked = formAllowedMethods.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                          checked
                            ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAllowedPaymentMethod(m.id)}
                          className="rounded border-slate-300"
                        />
                        <span>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات حساب</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="توضیحات تکمیلی درباره کاربری حساب..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-700"
                  />
                  <span>حساب فعال و قابل انتخاب در ثبت پرداخت</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600"
                  />
                  <span>تنظیم به‌عنوان حساب پیش‌فرض پرداخت شرکت</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBankAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingBankAccount}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
                >
                  {isSavingBankAccount
                    ? 'در حال ذخیره در سرور...'
                    : editingBankAccount
                    ? 'ذخیره تغییرات حساب مبدأ'
                    : 'ثبت حساب بانکی مبدأ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
