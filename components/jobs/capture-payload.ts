/** A browser bookmark sends these fields to the review form in the URL fragment. */
export type CapturedJob = {
  url: string;
  company: string;
  title: string;
  location: string;
  description: string;
};

const MAX_FRAGMENT_LENGTH = 60_000;

export function readCaptureFragment(fragment: string): CapturedJob | null {
  if (!fragment.startsWith("#capture=") || fragment.length > MAX_FRAGMENT_LENGTH) return null;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(fragment.slice("#capture=".length)));
    if (!data || typeof data !== "object") return null;
    const fields = data as Record<string, unknown>;
    const url = fields.url;
    if (typeof url !== "string" || url.length > 2000) return null;
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const field = (name: string, max: number) => typeof fields[name] === "string" ? (fields[name] as string).slice(0, max) : "";
    return {
      url: parsed.toString(),
      company: field("company", 160),
      title: field("title", 200),
      location: field("location", 160),
      description: field("description", 40_000),
    };
  } catch {
    return null;
  }
}

/**
 * The bookmark reads the page the person is viewing. It navigates to the review
 * form; it never calls an API or saves a job by itself.
 */
export function jobCaptureBookmarklet(origin: string): string {
  const destination = new URL("/app/jobs?capture=1", origin).toString();
  const script = `(function(){
    var d=document;
    function clean(s){return String(s||"").replace(/\\s+/g," ").trim()}
    function plain(s){var e=d.createElement("div");e.innerHTML=String(s||"").replace(/<\\/(p|li|div|h[1-6])>/gi,"$&\\n").replace(/<br\\s*\\/?>/gi,"$&\\n");return String(e.textContent||"").replace(/[ \\t]+/g," ").replace(/\\n[ \\t]+/g,"\\n").replace(/\\n{3,}/g,"\\n\\n").trim()}
    function posting(n){
      if(!n||typeof n!=="object")return null;
      if(Array.isArray(n)){for(var i=0;i<n.length;i++){var v=posting(n[i]);if(v)return v}return null}
      if(n["@type"]==="JobPosting"||Array.isArray(n["@type"])&&n["@type"].includes("JobPosting"))return n;
      return posting(n["@graph"])
    }
    var p=null, scripts=d.querySelectorAll('script[type="application/ld+json"]');
    for(var i=0;i<scripts.length&&!p;i++){try{p=posting(JSON.parse(scripts[i].textContent||""))}catch(e){}}
    var chosen=clean(String(window.getSelection&&window.getSelection()||""));
    var main=d.querySelector("main, article, [role=main]");
    var structured=plain(p&&p.description);
    var body=chosen.length>=200?chosen:structured.length>=200?structured:String(main&&main.innerText||"").trim()||structured;
    var org=p&&p.hiringOrganization;
    var loc=p&&p.jobLocation;loc=Array.isArray(loc)?loc[0]:loc;
    var address=loc&&loc.address;
    var data={
      url:location.href,
      company:clean(typeof org==="string"?org:org&&org.name)||clean(d.querySelector('meta[property="og:site_name"]')?.content),
      title:plain(p&&p.title)||clean(d.querySelector("h1")?.textContent)||clean(d.title).split(/\\s+[|–-]\\s+/)[0],
      location:clean([address&&address.addressLocality,address&&address.addressRegion].filter(Boolean).join(", ")),
      description:body.slice(0,12000)
    };
    var encoded=encodeURIComponent(JSON.stringify(data));
    while(encoded.length>58000&&data.description.length){data.description=data.description.slice(0,Math.floor(data.description.length*0.8));encoded=encodeURIComponent(JSON.stringify(data))}
    location.href=${JSON.stringify(destination)}+"#capture="+encoded;
  })()`;
  return `javascript:${script.replace(/\s+/g, " ")}`;
}
