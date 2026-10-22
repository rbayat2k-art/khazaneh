import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal } from 'lucide-react';
import { NEXTJS_PRISMA_TEMPLATES } from '../data/nextjsCodeTemplates';

export const CodeArchitectureView: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState(NEXTJS_PRISMA_TEMPLATES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeTemplate =
    NEXTJS_PRISMA_TEMPLATES.find((t) => t.id === selectedFileId) || NEXTJS_PRISMA_TEMPLATES[0];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              مستندات فنی، دستورات راه‌اندازی و کدهای کامل Next.js (App Router) + Prisma ORM
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              علاوه بر پورتال عملیاتی زنده، کدهای کامل Prisma Schema، Server Actions، NextAuth RBAC و ساختار App Router جهت کپی مستقیم در Visual Studio Code آماده شده‌اند.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-mono-num">
              prisma/schema.prisma موجود در مخزن پروژه
            </span>
          </div>
        </div>

        {/* Setup CLI Instructions */}
        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Terminal className="w-4 h-4" />
              <span>دستورات نصب و راه‌اندازی در Visual Studio Code (SQLite + Prisma + NextAuth)</span>
            </span>
          </div>
          <pre dir="ltr" className="text-left text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`# 1. Initialize Next.js App Router & Install Prisma + NextAuth
npx create-next-app@latest treasury-portal --typescript --tailwind --app
cd treasury-portal
npm install @prisma/client next-auth bcryptjs lucide-react
npm install -D prisma @types/bcryptjs

# 2. Initialize SQLite Database & Generate Prisma Client
npx prisma init --datasource-provider sqlite
npx prisma migrate dev --name init_treasury_portal
npx prisma generate`}
          </pre>
        </div>

        {/* File Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg" role="tablist">
          {NEXTJS_PRISMA_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              role="tab"
              aria-selected={selectedFileId === tpl.id}
              onClick={() => setSelectedFileId(tpl.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedFileId === tpl.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{tpl.title}</span>
            </button>
          ))}
        </div>

        {/* Active Code Viewer */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-slate-900">{activeTemplate.title}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{activeTemplate.description}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span dir="ltr" className="text-xs font-mono text-slate-600 bg-slate-200/70 px-2.5 py-1 rounded">
                {activeTemplate.filePath}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(activeTemplate.id, activeTemplate.code)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedId === activeTemplate.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی کد کامل فایل</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed max-h-[540px]"
          >
            <code>{activeTemplate.code}</code>
          </pre>
        </div>
      </section>
    </div>
  );
};
