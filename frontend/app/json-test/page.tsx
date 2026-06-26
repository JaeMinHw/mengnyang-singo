import testData from "../../shared/test.json";

export default function JsonTestPage() {
  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-xl font-bold mb-4">Shared JSON Test</h1>
      <pre className="rounded-lg bg-gray-100 p-4 text-sm">
        {JSON.stringify(testData, null, 2)}
      </pre>
    </main>
  );
}