export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Xkorienta API</h1>
        <p className="text-lg text-gray-600 mb-8">
          Backend API Server for Xkorienta Application
        </p>
        <div className="bg-gray-100 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">API Endpoints</h2>
          <p className="text-gray-600 mb-4">
            All API endpoints are available at{" "}
            <code className="bg-gray-200 px-2 py-1 rounded">/api/*</code>
          </p>
          <div className="text-left">
            <p className="text-sm text-gray-500">Server Status:</p>
            <p className="text-green-600 font-medium">🟢 Running</p>
          </div>
        </div>
      </div>
    </main>
  );
}
