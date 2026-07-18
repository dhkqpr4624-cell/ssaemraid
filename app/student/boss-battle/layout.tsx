import { Suspense } from 'react';
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<div className="min-h-screen bg-slate-950"/>}>{children}</Suspense>}
