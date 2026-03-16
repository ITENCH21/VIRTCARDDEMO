import { useState, useMemo } from 'react';
import { useLang } from '../contexts/LangContext';

/* ── Домены для фавиконов ── */
const DOMAIN: Record<string, string> = {
  'Google': 'google.com', 'Facebook': 'facebook.com', 'TikTok': 'tiktok.com',
  'Keitaro': 'keitaro.io', 'DigitalOcean': 'digitalocean.com', 'GlobalTelehost': 'globaltelehost.com',
  'McHost': 'mchost.ru', 'AppsFlyer': 'appsflyer.com', 'FastSpring': 'fastspring.com',
  'Apple': 'apple.com', 'PropellerAds': 'propellerads.com', 'SOAX': 'soax.com',
  'Hetzner': 'hetzner.com', 'Ionos': 'ionos.com', 'GetUniq': 'getuniq.me',
  'Hostzealot': 'hostzealot.com', 'ExoClick': 'exoclick.com', 'Zomro': 'zomro.com',
  'Jotform': 'jotform.com', 'MountProxies': 'mountproxies.com', 'Zadarma': 'zadarma.com',
  'OVHcloud': 'ovhcloud.com', 'Ahrefs': 'ahrefs.com', 'GoDaddy': 'godaddy.com',
  'Paddle': 'paddle.com', 'PayPal': 'paypal.com', 'Synthesia': 'synthesia.io',
  'Scaleway': 'scaleway.com', 'Amazon': 'amazon.com', 'Tilda': 'tilda.cc',
  'Atlassian': 'atlassian.com', 'Outbrain': 'outbrain.com', 'Upwork': 'upwork.com',
  'Remini': 'remini.ai', 'NapoleonCat': 'napoleoncat.com', 'IsHosting': 'ishosting.com',
  'Octo Browser': 'octobrowser.net', 'Shopify': 'shopify.com', 'Dolphin Anty': 'dolphin.ru.com',
  'Mullvad VPN': 'mullvad.net', 'Freepik': 'freepik.com', 'Netim': 'netim.com',
  'OpenProvider': 'openprovider.com', 'BuyProxies': 'buyproxies.org', 'Proton': 'proton.me',
  'Zoho': 'zoho.com', 'Ikoula': 'ikoula.com', 'Names.co.uk': 'names.co.uk',
  'Qonto': 'qonto.com', 'Taboola': 'taboola.com', 'PayPro': 'paypro.global',
  'Hostpoint': 'hostpoint.ch', 'NordLayer': 'nordlayer.com', 'iubenda': 'iubenda.com',
  'AdSpy': 'adspy.com', 'Microsoft': 'microsoft.com', 'AVG': 'avg.com',
  'GetCourse': 'getcourse.ru', 'Unity': 'unity.com', 'Slack': 'slack.com',
  'Maxon': 'maxon.net', 'SendPulse': 'sendpulse.com', 'LinkedIn': 'linkedin.com',
  'Patreon': 'patreon.com', 'OpenAI': 'openai.com', 'Wordwall': 'wordwall.net',
  'Miro': 'miro.com', 'GeoGuessr': 'geoguessr.com', 'Snapchat': 'snapchat.com',
  'Starlink': 'starlink.com', 'HeyGen': 'heygen.com', 'Uber': 'uber.com',
  'Yango': 'yango.com', 'Anthropic': 'anthropic.com', 'WeMod': 'wemod.com',
  'Careem': 'careem.com', 'Envato': 'envato.com', 'Quizlet': 'quizlet.com',
  'GoPro': 'gopro.com', 'Zoom': 'zoom.us', 'Cloudflare': 'cloudflare.com',
  'Higgsfield': 'higgsfield.ai', 'Perplexity AI': 'perplexity.ai', 'Meta': 'meta.com',
  'Porkbun': 'porkbun.com', 'Twilio': 'twilio.com', 'Windsurf': 'windsurf.com',
  'Midjourney': 'midjourney.com', 'OnlyFans': 'onlyfans.com', 'Namecheap': 'namecheap.com',
  'Cursor': 'cursor.com', 'ElevenLabs': 'elevenlabs.io', 'GitHub': 'github.com',
  'Hostinger': 'hostinger.com', 'Telegram Premium': 'telegram.org', 'xAI': 'x.ai',
  'Figma': 'figma.com', 'Suno AI': 'suno.ai', 'ScraperAPI': 'scraperapi.com',
  'Brave': 'brave.com', 'VDSina': 'vdsina.com', 'Multilogin': 'multilogin.com',
  'Artlist': 'artlist.io', 'ActiveCampaign': 'activecampaign.com', 'Adobe': 'adobe.com',
  'ClickUp': 'clickup.com', 'Notion': 'notion.so', 'Intercom': 'intercom.com',
  'IPRoyal': 'iproyal.com', 'Linode': 'linode.com', 'Lovable': 'lovable.dev',
  'DEWA': 'dewa.gov.ae', 'Mintmobile': 'mintmobile.com', 'Deliveroo': 'deliveroo.com',
  'Talabat': 'talabat.com', 'AWS': 'aws.amazon.com', 'BunnyCDN': 'bunny.net',
  'Mailchimp': 'mailchimp.com', 'ManyChat': 'manychat.com', 'NameSilo': 'namesilo.com',
  'OpenRouter': 'openrouter.ai', 'RapidAPI': 'rapidapi.com', 'Runway': 'runwayml.com',
  'Webflow': 'webflow.com', 'Sumsub': 'sumsub.com', 'Spaceship': 'spaceship.com',
  'Freelancer.com': 'freelancer.com', 'KREA AI': 'krea.ai', 'Groq': 'groq.com',
  'Reviews.io': 'reviews.io', 'Resend': 'resend.com', 'Smartcat': 'smartcat.com',
  'AdCreative.ai': 'adcreative.ai', 'AppFollow': 'appfollow.io', 'Chainstack': 'chainstack.com',
  'Alibaba Cloud': 'alibabacloud.com', 'Portmone': 'portmone.com', 'Canva': 'canva.com',
  'AdsPower': 'adspower.com', 'Apify': 'apify.com', 'Apollo.io': 'apollo.io',
  'AWeber': 'aweber.com', 'Manus AI': 'manus.im', 'Abacus.AI': 'abacus.ai',
  'Airalo': 'airalo.com', 'Render': 'render.com', 'ExpressVPN': 'expressvpn.com',
  'HighLevel': 'gohighlevel.com', 'TurboScribe': 'turboscribe.ai', 'Mailgun': 'mailgun.com',
  'Opus Clip': 'opus.pro', 'Bitwarden': 'bitwarden.com', 'VEED': 'veed.io',
  'Retool': 'retool.com', 'Vultr': 'vultr.com', 'RunComfy': 'runcomfy.com',
  'Numero eSIM': 'numero.app', 'INWX': 'inwx.com', 'HostPro': 'hostpro.ua',
  'Fixer.io': 'fixer.io', 'Mediastack': 'mediastack.com', 'NOWNodes': 'nownodes.io',
  'Ficbook': 'ficbook.net', 'Genspark AI': 'genspark.ai', 'Netflix': 'netflix.com',
  'SimplePod AI': 'simplepod.ai', 'AliExpress': 'aliexpress.com', 'PlayStation': 'playstation.com',
  'BYOK': 'byok.ai', 'Creem.io': 'creem.io', 'Airbnb': 'airbnb.com',
  'Glovo': 'glovoapp.com', 'Bolt': 'bolt.eu', 'Orange Flex': 'orange.pl',
  'GloriaForce': 'gloriaforce.com', 'Deal Delivery Gurus': 'dealdeliverygurus.com',
  'Borcov Group': 'borcovgroup.com', 'Vision Net': 'vision.net', 'Servercore': 'servercore.com',
  'ResidentialVPS': 'residentialvps.com', 'IHServers': 'ihservers.com',
  'Comm100': 'comm100.com', 'FormBackend': 'formbackend.com', 'InternetBS': 'internetbs.net',
  'Postale.io': 'postale.io', 'MOREmins': 'moremins.com', 'Arcads.AI': 'arcads.ai',
  // Pay section extras
  'Moonshot AI': 'moonshot.cn', 'WaveSpeed AI': 'wavespeed.ai', 'KodeKloud': 'kodekloud.com',
  'NodeMaven': 'nodemaven.com', 'Gumroad': 'gumroad.com', 'KIRO PRO': 'kiro.dev',
  'Yesim': 'yesim.app', 'iHerb': 'iherb.com', 'FreeNow': 'free-now.com',
  'Cabify': 'cabify.com', 'Grab': 'grab.com', 'Booking.com': 'booking.com',
  'GetYourGuide': 'getyourguide.com', 'Headout': 'headout.com', 'Mobimatter': 'mobimatter.com',
  'eBay': 'ebay.com', 'H&M': 'hm.com', 'Intimissimi': 'intimissimi.com',
  'El Corte Inglés': 'elcorteingles.es', 'Carrefour': 'carrefour.com',
  'Intersport': 'intersport.com', 'Foodora': 'foodora.com', 'Tim Hortons': 'timhortons.com',
  "McDonald's": 'mcdonalds.com', 'Yoshinoya': 'yoshinoya.com', 'Eataly': 'eataly.com',
  'Suica Mobile': 'jreast.co.jp', 'Customer.io': 'customer.io',
};

const STANDARD = [
  'Google','Facebook','TikTok','Keitaro','DigitalOcean','GlobalTelehost','McHost',
  'AppsFlyer','FastSpring','Apple','PropellerAds','SOAX','Hetzner','Ionos','GetUniq',
  'Hostzealot','ExoClick','Zomro','Jotform','MountProxies','Zadarma','OVHcloud',
  'Deal Delivery Gurus','Ahrefs','GoDaddy','Paddle','PayPal','Synthesia','Scaleway',
  'Amazon','Tilda','Atlassian','Outbrain','Upwork','Remini','NapoleonCat','IsHosting',
  'Octo Browser','Shopify','Dolphin Anty','Mullvad VPN','Freepik','Netim','OpenProvider',
  'BuyProxies','Proton','Zoho','Ikoula','Names.co.uk','Qonto','Taboola','PayPro',
  'Borcov Group','Hostpoint','Vision Net','NordLayer','iubenda','AdSpy','Microsoft',
  'AVG','GetCourse','Unity','Slack','Maxon','SendPulse','LinkedIn','Patreon','OpenAI',
  'Wordwall','Miro','GeoGuessr','Snapchat','GloriaForce','Starlink','HeyGen','Uber',
  'Yango','Anthropic','WeMod','Careem','Envato','Quizlet','GoPro','Zoom','Cloudflare',
  'Higgsfield','Perplexity AI','Meta','Porkbun','Twilio','Windsurf','Midjourney',
  'OnlyFans','Namecheap','Cursor','ElevenLabs','GitHub','Hostinger','Telegram Premium',
  'xAI','Figma','Suno AI','ScraperAPI','Brave','VDSina','Multilogin','Servercore',
  'Artlist','ActiveCampaign','Adobe','ClickUp','Customer.io','Notion','Intercom',
  'IPRoyal','Linode','Lovable','DEWA','Mintmobile','Deliveroo','Talabat','AWS',
  'BunnyCDN','Mailchimp','ManyChat','NameSilo','OpenRouter','RapidAPI','Runway',
  'Webflow','Sumsub','Spaceship','Freelancer.com','KREA AI','Groq','Reviews.io',
  'Resend','Smartcat','AdCreative.ai','AppFollow','Chainstack','Alibaba Cloud',
  'Portmone','Canva','AdsPower','Apify','Apollo.io','Arcads.AI','AWeber','Manus AI',
  'Abacus.AI','Airalo','Render','ExpressVPN','HighLevel','TurboScribe','Mailgun',
  'Opus Clip','Bitwarden','VEED','Retool','Vultr','RunComfy','Numero eSIM','INWX',
  'HostPro','Fixer.io','Mediastack','ResidentialVPS','IHServers','Comm100',
  'FormBackend','InternetBS','NOWNodes','Ficbook','Postale.io','MOREmins',
  'Genspark AI','Netflix','SimplePod AI','AliExpress','PlayStation','BYOK','Creem.io',
  'Airbnb','Glovo','Bolt','Orange Flex',
];

const PAY = [
  'Patreon','GeoGuessr','Freepik','Wordwall','Uber','Google','WeMod','HeyGen',
  'SimplePod AI','GoPro','Quizlet','Miro','Orange Flex','ElevenLabs','AliExpress',
  'Zoom','Runway','Namecheap','Netflix','Genspark AI','Moonshot AI','WaveSpeed AI',
  'Creem.io','BYOK','Spaceship','RunComfy','PlayStation','Figma','DigitalOcean',
  'Envato','KodeKloud','Suno AI','NodeMaven','Gumroad','KIRO PRO','Yesim','iHerb',
  'Bolt','Glovo','FreeNow','Cabify','Grab','Airbnb','Booking.com','GetYourGuide',
  'Headout','Mobimatter','eBay','H&M','Intimissimi','El Corte Inglés','Carrefour',
  'Intersport','Foodora','Tim Hortons',"McDonald's",'Yoshinoya','Eataly','PayPal',
  'Suica Mobile',
];

function faviconUrl(name: string) {
  const domain = DOMAIN[name];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function FallbackIcon({ name }: { name: string }) {
  const colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function ServiceTile({ name, highlight }: { name: string; highlight?: string }) {
  const [imgOk, setImgOk] = useState(true);
  const url = faviconUrl(name);

  const label = highlight
    ? name.replace(new RegExp(`(${highlight})`, 'gi'), '§$1§')
    : name;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '10px 4px', borderRadius: 12,
      background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
      cursor: 'default', minWidth: 0,
    }}>
      {url && imgOk
        ? <img src={url} onError={() => setImgOk(false)} width={28} height={28} style={{ borderRadius: 6, objectFit: 'contain' }} alt="" />
        : <FallbackIcon name={name} />
      }
      <span style={{
        fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center',
        lineHeight: 1.3, wordBreak: 'break-word', maxHeight: 26, overflow: 'hidden',
      }}>
        {highlight
          ? label.split('§').map((part, i) =>
              part.toLowerCase() === highlight.toLowerCase()
                ? <mark key={i} style={{ background: 'rgba(99,102,241,0.25)', color: 'var(--text-primary)', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
                : part
            )
          : name
        }
      </span>
    </div>
  );
}

function Section({ title, badge, accent, items, query, defaultOpen = true }: {
  title: string; badge: string; accent: string; items: string[]; query: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 12,
          background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
          cursor: 'pointer', marginBottom: open ? 10 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: accent + '22', color: accent, border: `1px solid ${accent}44`,
          }}>
            {badge}
          </span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" width="16" height="16"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {items.map(name => (
            <ServiceTile key={name} name={name} highlight={query || undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ServicesPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'standard' | 'pay'>('standard');
  const { t } = useLang();

  const q = query.trim().toLowerCase();

  const filteredStandard = useMemo(() =>
    q ? STANDARD.filter(n => n.toLowerCase().includes(q)) : STANDARD, [q]);
  const filteredPay = useMemo(() =>
    q ? PAY.filter(n => n.toLowerCase().includes(q)) : PAY, [q]);

  const isSearching = q.length > 0;
  const totalFound = filteredStandard.length + filteredPay.length;

  return (
    <div className="page">

      {/* Поиск */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" width="16" height="16"
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('services_search_placeholder')}
          className="form-input"
          style={{ paddingLeft: 38, paddingRight: query ? 36 : 14 }}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => setQuery('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </button>
        )}
      </div>

      {/* Инфо вайт-лист */}
      {!isSearching && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
          borderLeft: '3px solid #6366f1',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>{t('services_whitelist_title')}</strong>{' '}{t('services_whitelist_detail')}
        </div>
      )}

      {/* Результат поиска */}
      {isSearching ? (
        totalFound === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {t('services_no_results')} «{query}»
          </div>
        ) : (
          <>
            {filteredStandard.length > 0 && (
              <Section title={t('services_tab_standard')} badge={`${filteredStandard.length}`} accent="#3b82f6"
                items={filteredStandard} query={q} />
            )}
            {filteredPay.length > 0 && (
              <Section title={t('services_tab_pay')} badge={`${filteredPay.length}`} accent="#6366f1"
                items={filteredPay} query={q} />
            )}
          </>
        )
      ) : (
        <>
          {/* Табы */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['standard', 'pay'] as const).map(tabKey => (
              <button key={tabKey} onClick={() => setTab(tabKey)} style={{
                flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', transition: 'var(--transition-fast)',
                background: tab === tabKey ? 'var(--accent-gradient)' : 'var(--bg-glass)',
                border: tab === tabKey ? '1px solid transparent' : '1px solid var(--border-glass)',
                color: tab === tabKey ? '#fff' : 'var(--text-secondary)',
                boxShadow: tab === tabKey ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
              }}>
                {tabKey === 'standard' ? `${t('services_tab_standard')} (${STANDARD.length})` : `${t('services_tab_pay')} (${PAY.length})`}
              </button>
            ))}
          </div>

          {tab === 'standard' && (
            <Section title={t('services_tab_standard')} badge={`${STANDARD.length} ${t('services_count')}`} accent="#3b82f6"
              items={STANDARD} query="" />
          )}
          {tab === 'pay' && (
            <Section title={t('services_tab_pay')} badge={`${PAY.length} ${t('services_count')}`} accent="#6366f1"
              items={PAY} query="" />
          )}
        </>
      )}
    </div>
  );
}
