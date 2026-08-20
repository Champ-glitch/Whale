// pages/admin/invoices.js
// Superseded by /admin/transfers (Invoices tab).
export async function getServerSideProps() {
  return { redirect: { destination: '/admin/transfers?tab=invoices', permanent: false } };
}

export default function InvoicesRedirect() {
  return null;
}
