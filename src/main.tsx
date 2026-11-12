import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './fonts.css';
import './index.css';
import { captureReferral } from '@/lib/referral';
import { captureAffiliate } from '@/lib/affiliate';

captureReferral(); // remember ?ref=CODE before any redirect drops the query string
captureAffiliate(); // influencer links: ?via=CODE
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Real-user speed (Core Web Vitals) — loaded after the page so it never slows the first paint. Visible in Vercel → Speed Insights.
const startRum = () => import('@vercel/speed-insights').then(({ injectSpeedInsights }) => injectSpeedInsights());
if (document.readyState === 'complete') setTimeout(startRum, 2000);
else window.addEventListener('load', () => setTimeout(startRum, 2000), { once: true });
