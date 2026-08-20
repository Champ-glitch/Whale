// pages/admin/send.js
// Superseded by /admin/transfers (Request tab) — kept as a redirect so any
// old bookmarks/links still land somewhere useful.
export async function getServerSideProps() {
  return { redirect: { destination: '/admin/transfers?tab=request', permanent: false } };
}

export default function SendRedirect() {
  return null;
}
