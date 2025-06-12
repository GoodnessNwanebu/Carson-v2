'use client'

import { useNotificationHelpers } from "@/components/ui/notification-system"
import CarsonUI from "@/components/carson-ui"

export default function HomePage() {
  const { success, error, warning, info } = useNotificationHelpers()

  // Demo function for testing notifications (remove in production)
  const testNotifications = () => {
    setTimeout(() => success('Success!', 'This is a success notification'), 500)
    setTimeout(() => warning('Warning', 'This is a warning notification'), 1000)
    setTimeout(() => error('Error', 'This is an error notification'), 1500)
    setTimeout(() => info('Info', 'This is an info notification'), 2000)
  }

  return (
    <div className="relative h-full">
      <CarsonUI />
      
      {/* Demo button - remove in production */}
      <button
        onClick={testNotifications}
        className="fixed bottom-4 right-4 z-40 bg-blue-500 text-white px-3 py-1 rounded text-sm opacity-20 hover:opacity-100 transition-opacity"
      >
        Test Notifications
      </button>
    </div>
  )
}
