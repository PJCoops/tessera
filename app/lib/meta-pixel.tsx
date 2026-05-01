// Standard Meta Pixel install — split into <head> and <body> halves so the
// inline script lives in <head> (Meta's recommendation) while the noscript
// fallback sits in <body>. Custom events are fired from analytics.ts so
// PostHog and Meta stay in lockstep.
//
// No reverse proxy here on purpose: Meta's fbevents.js hardcodes its event
// endpoint, so a URL rewrite doesn't help much. The right bypass for
// adblocker losses is the Conversions API (server-side), which dedupes
// against this Pixel via a shared event_id.

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

const pixelScript = (id: string) => `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
`;

export function MetaPixelHead() {
  if (!META_PIXEL_ID) return null;
  return <script dangerouslySetInnerHTML={{ __html: pixelScript(META_PIXEL_ID) }} />;
}

export function MetaPixelNoScript() {
  if (!META_PIXEL_ID) return null;
  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
