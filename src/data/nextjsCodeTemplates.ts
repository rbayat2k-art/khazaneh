export interface CodeFileTemplate {
  id: string;
  title: string;
  filePath: string;
  description: string;
  code: string;
}

export const NEXTJS_PRISMA_TEMPLATES: CodeFileTemplate[] = [
  {
    id: 'prisma-schema',
    title: '۱. مدل‌های دیتابیس (Prisma Schema)',
    filePath: 'prisma/schema.prisma',
    description:
      'اسکیمای کامل Prisma ORM منطبق با SQLite و قابل ارتقا به PostgreSQL شامل مدل‌های User، AdvanceRequest، PaymentRequest، ManualPayment، DailyCover و ReceiptArchive.',
    code: `// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // در محیط پروداکشن به "postgresql" تغییر دهید
  url      = env("DATABASE_URL")
}

enum Role {
  EMPLOYEE
  SUPERVISOR
  ACCOUNTING
  TREASURY
}

enum RequestStatus {
  Pending_Supervisor
  Pending_Accounting
  Pending_Treasury
  Paid
  Rejected
}

enum Priority {
  Normal
  Urgent
}

enum AccountBalanceStatus {
  HasBalance
  NoBalance
  NeedsCheck
}

enum CoverStatus {
  Open
  Closed
}

model User {
  id            String   @id @default(cuid())
  name          String
  personnelCode String   @unique
  department    String
  role          Role     @default(EMPLOYEE)
  password      String
  createdAt     DateTime @default(now())

  advanceRequestsSubmitted  AdvanceRequest[] @relation("AdvanceRequester")
  advanceRequestsSupervised AdvanceRequest[] @relation("AdvanceSupervisor")
  advanceRequestsAccounted  AdvanceRequest[] @relation("AdvanceAccounting")
  advanceRequestsPaid       AdvanceRequest[] @relation("AdvanceTreasury")

  paymentRequestsSubmitted  PaymentRequest[] @relation("PaymentRequester")
  paymentRequestsSupervised PaymentRequest[] @relation("PaymentSupervisor")
  paymentRequestsAccounted  PaymentRequest[] @relation("PaymentAccounting")
  paymentRequestsPaid       PaymentRequest[] @relation("PaymentTreasury")

  manualPaymentsCreated     ManualPayment[]  @relation("ManualPaymentCreator")
}

model AdvanceRequest {
  id                 String        @id @default(cuid())
  trackingCode       String        @unique
  requestedMonth     String
  amount             Float
  suggestedDate      String
  reason             String
  hasPreviousAdvance Boolean?
  approvedAmount     Float?
  accountingNote     String?
  supervisorNote     String?
  status             RequestStatus @default(Pending_Supervisor)
  createdAt          DateTime      @default(now())

  requesterId  String
  requester    User   @relation("AdvanceRequester", fields: [requesterId], references: [id])
  supervisorId String?
  supervisor   User?  @relation("AdvanceSupervisor", fields: [supervisorId], references: [id])
  accountingId String?
  accounting   User?  @relation("AdvanceAccounting", fields: [accountingId], references: [id])
  treasuryId   String?
  treasury     User?  @relation("AdvanceTreasury", fields: [treasuryId], references: [id])

  dailyCoverId String?
  dailyCover   DailyCover?      @relation(fields: [dailyCoverId], references: [id])
  receipts     ReceiptArchive[]
}

model PaymentRequest {
  id                   String                @id @default(cuid())
  trackingCode         String                @unique
  dueDate              String
  priority             Priority              @default(Normal)
  costCenter           String
  description          String
  amount               Float
  payeeName            String
  accountOrCard        String
  iban                 String
  bankName             String
  invoiceNumber        String
  accountBalanceStatus AccountBalanceStatus?
  accountingNote       String?
  status               RequestStatus         @default(Pending_Supervisor)
  createdAt            DateTime              @default(now())

  requesterId  String
  requester    User   @relation("PaymentRequester", fields: [requesterId], references: [id])
  supervisorId String?
  supervisor   User?  @relation("PaymentSupervisor", fields: [supervisorId], references: [id])
  accountingId String?
  accounting   User?  @relation("PaymentAccounting", fields: [accountingId], references: [id])
  treasuryId   String?
  treasury     User?  @relation("PaymentTreasury", fields: [treasuryId], references: [id])

  dailyCoverId String?
  dailyCover   DailyCover?      @relation(fields: [dailyCoverId], references: [id])
  receipts     ReceiptArchive[]
}

model ManualPayment {
  id          String   @id @default(cuid())
  amount      Float
  payee       String
  description String
  bankName    String
  date        String
  createdAt   DateTime @default(now())

  createdById  String
  createdBy    User        @relation("ManualPaymentCreator", fields: [createdById], references: [id])
  dailyCoverId String?
  dailyCover   DailyCover? @relation(fields: [dailyCoverId], references: [id])
  receipts     ReceiptArchive[]
}

model DailyCover {
  id          String      @id @default(cuid())
  date        String
  totalIn     Float       @default(0)
  totalOut    Float       @default(0)
  bankFee     Float       @default(0)
  bankAccount String
  status      CoverStatus @default(Open)
  createdAt   DateTime    @default(now())

  advanceRequests AdvanceRequest[]
  paymentRequests PaymentRequest[]
  manualPayments  ManualPayment[]
}

model ReceiptArchive {
  id               String   @id @default(cuid())
  fileUrl          String
  uploadedAt       DateTime @default(now())
  relatedPaymentId String

  advanceRequestId String?
  advanceRequest   AdvanceRequest? @relation(fields: [advanceRequestId], references: [id])
  paymentRequestId String?
  paymentRequest   PaymentRequest? @relation(fields: [paymentRequestId], references: [id])
  manualPaymentId  String?
  manualPayment    ManualPayment?  @relation(fields: [manualPaymentId], references: [id])
}`,
  },
  {
    id: 'server-actions',
    title: '۲. اکشن‌های سرور (Next.js Server Actions)',
    filePath: 'app/actions/financial-actions.ts',
    description:
      'تمامی Server Actionهای مربوط به ثبت درخواست مساعده و پرداخت، تایید سرپرست، بررسی حسابداری، اجرای پرداخت تکی/گروهی خزانه و بستن روکش روزانه.',
    code: `'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ۱. ثبت درخواست مساعده توسط کارمند
export async function submitAdvanceRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('عدم دسترسی مجاز');

  const requestedMonth = String(formData.get('requestedMonth'));
  const amount = Number(formData.get('amount'));
  const suggestedDate = String(formData.get('suggestedDate'));
  const reason = String(formData.get('reason'));

  const record = await prisma.advanceRequest.create({
    data: {
      trackingCode: \`ADV-\${Date.now().toString().slice(-6)}\`,
      requestedMonth,
      amount,
      suggestedDate,
      reason,
      requesterId: session.user.id,
      status: 'Pending_Supervisor',
    },
  });

  revalidatePath('/dashboard');
  return { success: true, record };
}

// ۲. تایید یا رد توسط سرپرست واحد
export async function supervisorReviewAction(
  requestId: string,
  requestType: 'ADVANCE' | 'PAYMENT',
  approved: boolean,
  supervisorNote: string
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'SUPERVISOR') throw new Error('فقط سرپرست واحد مجاز است');

  const nextStatus = approved ? 'Pending_Accounting' : 'Rejected';

  if (requestType === 'ADVANCE') {
    await prisma.advanceRequest.update({
      where: { id: requestId },
      data: { status: nextStatus, supervisorId: session.user.id, supervisorNote },
    });
  } else {
    await prisma.paymentRequest.update({
      where: { id: requestId },
      data: { status: nextStatus, supervisorId: session.user.id },
    });
  }

  revalidatePath('/supervisor');
  revalidatePath('/accounting');
}

// ۳. بررسی حسابداری و ارسال به صف خزانه
export async function accountingApproveAction(payload: {
  requestId: string;
  requestType: 'ADVANCE' | 'PAYMENT';
  hasPreviousAdvance?: boolean;
  approvedAmount?: number;
  accountBalanceStatus?: 'HasBalance' | 'NoBalance' | 'NeedsCheck';
  accountingNote: string;
  approve: boolean;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ACCOUNTING') throw new Error('فقط واحد حسابداری مجاز است');

  const status = payload.approve ? 'Pending_Treasury' : 'Rejected';

  if (payload.requestType === 'ADVANCE') {
    await prisma.advanceRequest.update({
      where: { id: payload.requestId },
      data: {
        status,
        accountingId: session.user.id,
        hasPreviousAdvance: payload.hasPreviousAdvance,
        approvedAmount: payload.approvedAmount,
        accountingNote: payload.accountingNote,
      },
    });
  } else {
    await prisma.paymentRequest.update({
      where: { id: payload.requestId },
      data: {
        status,
        accountingId: session.user.id,
        accountBalanceStatus: payload.accountBalanceStatus,
        accountingNote: payload.accountingNote,
      },
    });
  }

  revalidatePath('/accounting');
  revalidatePath('/treasury');
}

// ۴. اجرای پرداخت تکی یا گروهی در خزانه + ثبت فیش بانکی
export async function executeTreasuryBulkPayment(payload: {
  advanceIds: string[];
  paymentIds: string[];
  receiptFileUrl: string;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'TREASURY') throw new Error('فقط خزانه‌دار مجاز است');

  await prisma.$transaction(async (tx) => {
    if (payload.advanceIds.length > 0) {
      await tx.advanceRequest.updateMany({
        where: { id: { in: payload.advanceIds } },
        data: { status: 'Paid', treasuryId: session.user.id },
      });
    }
    if (payload.paymentIds.length > 0) {
      await tx.paymentRequest.updateMany({
        where: { id: { in: payload.paymentIds } },
        data: { status: 'Paid', treasuryId: session.user.id },
      });
    }

    for (const id of [...payload.advanceIds, ...payload.paymentIds]) {
      await tx.receiptArchive.create({
        data: {
          fileUrl: payload.receiptFileUrl,
          relatedPaymentId: id,
        },
      });
    }
  });

  revalidatePath('/treasury');
}

// ۵. بستن روکش روزانه خزانه (Close Daily Cover)
export async function closeDailyCoverAction(payload: {
  date: string;
  bankAccount: string;
  totalIn: number;
  bankFee: number;
  advanceIds: string[];
  paymentIds: string[];
  manualIds: string[];
  totalOutCalculated: number;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'TREASURY') throw new Error('فقط خزانه‌دار مجاز است');

  const cover = await prisma.dailyCover.create({
    data: {
      date: payload.date,
      bankAccount: payload.bankAccount,
      totalIn: payload.totalIn,
      totalOut: payload.totalOutCalculated + payload.bankFee,
      bankFee: payload.bankFee,
      status: 'Closed',
      advanceRequests: { connect: payload.advanceIds.map((id) => ({ id })) },
      paymentRequests: { connect: payload.paymentIds.map((id) => ({ id })) },
      manualPayments: { connect: payload.manualIds.map((id) => ({ id })) },
    },
  });

  revalidatePath('/treasury/daily-cover');
  return cover;
}`,
  },
  {
    id: 'nextjs-layout-routing',
    title: '۳. ساختار روتینگ و Layout اصلی (Next.js App Router RTL)',
    filePath: 'app/(dashboard)/layout.tsx & app/(dashboard)/treasury/page.tsx',
    description:
      'ساختار App Router در Next.js 15 با پشتیبانی کامل از چیدمان راست‌به‌چپ (RTL)، فونت وزیرمتن و محافظت مسیرها بر اساس نقش کاربر (NextAuth Middleware).',
    code: `// app/(dashboard)/layout.tsx
import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import SidebarNav from '@/components/SidebarNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div dir="rtl" lang="fa" className="min-h-screen bg-slate-50 text-slate-900 flex">
      <SidebarNav user={session.user} />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

// ============================================================================
// app/(dashboard)/treasury/page.tsx
// ============================================================================
import { prisma } from '@/lib/prisma';
import TreasuryWorkspaceClient from '@/components/TreasuryWorkspaceClient';

export default async function TreasuryPage() {
  const [pendingAdvances, pendingPayments, manualPayments, dailyCovers] =
    await Promise.all([
      prisma.advanceRequest.findMany({
        where: { status: 'Pending_Treasury' },
        include: { requester: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentRequest.findMany({
        where: { status: 'Pending_Treasury' },
        include: { requester: true },
        orderBy: { priority: 'desc' },
      }),
      prisma.manualPayment.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyCover.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  return (
    <TreasuryWorkspaceClient
      pendingAdvances={pendingAdvances}
      pendingPayments={pendingPayments}
      manualPayments={manualPayments}
      dailyCovers={dailyCovers}
    />
  );
}`,
  },
  {
    id: 'nextauth-Upload-route',
    title: '۴. احراز هویت NextAuth.js و API آپلود فیش بانکی',
    filePath: 'lib/auth.ts & app/api/upload-receipt/route.ts',
    description:
      'پیکربندی NextAuth.js برای کنترل دسترسی مبتنی بر نقش (RBAC) به همراه Route Handler اختصاصی ذخیره محلی تصاویر فیش بانکی.',
    code: `// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'کد پرسنلی و رمز عبور',
      credentials: {
        personnelCode: { label: 'کد پرسنلی', type: 'text' },
        password: { label: 'رمز عبور', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.personnelCode || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { personnelCode: credentials.personnelCode },
        });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;
        return {
          id: user.id,
          name: user.name,
          role: user.role,
          department: user.department,
          personnelCode: user.personnelCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.department = (user as any).department;
        token.personnelCode = (user as any).personnelCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).department = token.department;
        (session.user as any).personnelCode = token.personnelCode;
      }
      return session;
    },
  },
};

// ============================================================================
// app/api/upload-receipt/route.ts (آپلود فیش بانکی در فضای محلی سرور)
// ============================================================================
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'فایلی انتخاب نشده است' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
  await mkdir(uploadDir, { recursive: true });

  const safeName = \`\${Date.now()}-\${file.name.replace(/\\s+/g, '_')}\`;
  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, buffer);

  return NextResponse.json({
    fileUrl: \`/uploads/receipts/\${safeName}\`,
    uploadedAt: new Date().toISOString(),
  });
}`,
  },
];
