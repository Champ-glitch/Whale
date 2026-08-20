// pages/admin/payments.js
// Superseded by /admin/transfers (Live tab).
export async function getServerSideProps() {
  return { redirect: { destination: '/admin/transfers?tab=payments', permanent: false } };
}

export default function PaymentsRedirect() {
  return null;
}
