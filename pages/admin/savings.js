// pages/admin/savings.js
// Savings/split feature removed - the till only tracks Available Now (Main
// balance) and Client Funds (money held for others). No automatic split.
export async function getServerSideProps() {
  return { redirect: { destination: '/admin', permanent: false } };
}

export default function SavingsRedirect() {
  return null;
}
