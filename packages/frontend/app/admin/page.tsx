import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <p className="text-gray-600 mb-4">This is the admin page filler content.</p>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Admin Features</h2>
        <ul className="space-y-2">
          <li className="flex items-center p-3 bg-gray-50 rounded">
            <Link href="/admin/users" className="text-blue-600 hover:text-blue-800">
              User Management
            </Link>
          </li>
          <li className="flex items-center p-3 bg-gray-50 rounded">
            <Link href="/admin/settings" className="text-blue-600 hover:text-blue-800">
              System Settings
            </Link>
          </li>
          <li className="flex items-center p-3 bg-gray-50 rounded">
            <Link href="/admin/logs" className="text-blue-600 hover:text-blue-800">
              Activity Logs
            </Link>
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}