# Notification System Documentation

## Overview

The notification system stores notifications in **MongoDB** and provides RESTful APIs for managing user notifications.

## Storage Architecture

```
MongoDB (Primary Storage)
    ↓
Express API Endpoints
    ↓
Flutter Client (via HTTP)
    ↓
SharedPreferences (Offline Cache)
```

## Database Schema

### Notification Model

```javascript
{
  userId: ObjectId,           // Reference to User
  title: String,              // Notification title
  message: String,            // Notification body
  type: String,               // booking | payment | message | review | system | promotion | price_alert | reminder
  data: Object,               // Additional JSON data
  isRead: Boolean,            // Read status
  readAt: Date,               // When marked as read
  isActive: Boolean,          // Soft delete flag
  priority: String,           // low | medium | high | urgent
  actionUrl: String,          // Deep link or URL
  imageUrl: String,           // Notification image
  expiresAt: Date,            // Auto-delete date (TTL)
  deliveredAt: Date,          // Push notification delivery time
  clickedAt: Date,            // When user clicked
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

### Indexes
- `userId + isRead` - Fast unread queries
- `userId + createdAt` - Chronological listing
- `userId + type` - Filter by notification type
- `expiresAt` - TTL index for auto-deletion

## API Endpoints

### 1. Get User Notifications
```http
GET /api/notifications?page=1&limit=20&unreadOnly=false
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20) - Items per page
- `unreadOnly` (default: false) - Show only unread

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "pages": 3
    },
    "unreadCount": 12
  }
}
```

### 2. Get Unread Count
```http
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 12
  }
}
```

### 3. Mark as Read
```http
PUT /api/notifications/:id/read
```

### 4. Mark All as Read
```http
PUT /api/notifications/mark-all-read
```

### 5. Delete Notification
```http
DELETE /api/notifications/:id
```

### 6. Clear All Notifications
```http
DELETE /api/notifications
```

### 7. Create Notification
```http
POST /api/notifications
Content-Type: application/json

{
  "userId": "user123",
  "title": "New Booking",
  "message": "You have a new booking request",
  "type": "booking",
  "priority": "high",
  "data": {
    "bookingId": "booking123"
  }
}
```

## Using the Notification Service

### In Other Controllers/Services

```javascript
import notificationService from '../services/notificationService.js';

// Example: Send booking confirmation
await notificationService.sendBookingNotification(userId, {
  bookingId: booking._id,
  propertyName: property.title
}, 'confirmed');

// Example: Send payment notification
await notificationService.sendPaymentNotification(userId, {
  amount: 150,
  currency: 'USD',
  success: true,
  paymentId: payment._id
});

// Example: Send custom notification
await notificationService.sendNotification({
  userId: user._id,
  title: 'Welcome!',
  message: 'Thanks for joining our platform',
  type: 'system',
  priority: 'medium'
});
```

### Bulk Notifications

```javascript
// Send to multiple users
const userIds = ['user1', 'user2', 'user3'];
await notificationService.sendBulkNotifications(userIds, {
  title: 'System Maintenance',
  message: 'Platform will be down for 2 hours',
  type: 'system',
  priority: 'high'
});
```

## Notification Types

| Type | Use Case | Priority |
|------|----------|----------|
| `booking` | Booking status updates | high |
| `payment` | Payment confirmations/failures | high |
| `message` | New chat messages | medium |
| `review` | New reviews received | low |
| `system` | System announcements | high |
| `promotion` | Marketing offers | low |
| `price_alert` | Wishlist price drops | medium |
| `reminder` | Upcoming events | medium |

## Authentication Middleware

⚠️ **Important**: Add authentication middleware to protect notification routes:

```javascript
// routes/notificationRoutes.js
import authMiddleware from '../middleware/auth.js';

router.use(authMiddleware); // Protect all routes
```

The middleware should:
1. Verify JWT token
2. Extract userId from token
3. Set `req.userId` for controllers to use

## Data Retention

### Auto-deletion via TTL
Set `expiresAt` field for auto-deletion:

```javascript
// Delete after 30 days
expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
```

### Manual Cleanup
Soft delete inactive notifications:

```javascript
await Notification.updateMany(
  { createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
  { $set: { isActive: false } }
);
```

## Flutter Integration

### 1. Update API Service

```dart
// lib/services/api_service.dart
class NotificationApiService {
  final String baseUrl = 'http://localhost:4000/api/notifications';
  
  Future<List<AppNotification>> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl?page=$page&limit=$limit&unreadOnly=$unreadOnly'),
      headers: {'Authorization': 'Bearer $token'}
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return (data['data']['notifications'] as List)
        .map((n) => AppNotification.fromJson(n))
        .toList();
    }
    throw Exception('Failed to load notifications');
  }
  
  Future<int> getUnreadCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/unread-count'),
      headers: {'Authorization': 'Bearer $token'}
    );
    
    final data = json.decode(response.body);
    return data['data']['unreadCount'];
  }
  
  Future<void> markAsRead(String id) async {
    await http.put(
      Uri.parse('$baseUrl/$id/read'),
      headers: {'Authorization': 'Bearer $token'}
    );
  }
}
```

### 2. Update Notification Service

Modify `lib/services/notification_service.dart` to sync with backend instead of using SharedPreferences only.

## Push Notifications (Future Enhancement)

### Firebase Cloud Messaging (FCM)

1. Add FCM device token to User model
2. Install FCM admin SDK: `npm install firebase-admin`
3. Send push notifications when creating notifications:

```javascript
import admin from 'firebase-admin';

async sendPushNotification(notification) {
  const user = await User.findById(notification.userId);
  
  if (user.fcmToken) {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.message
      },
      data: notification.data
    });
  }
}
```

## Testing

### Using curl

```bash
# Get notifications
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/notifications

# Mark as read
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/notifications/NOTIFICATION_ID/read

# Create notification
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId":"USER_ID","title":"Test","message":"Test message","type":"system"}' \
  http://localhost:4000/api/notifications
```

## Performance Considerations

1. **Pagination**: Always paginate notification lists
2. **Indexes**: Ensure indexes are created for fast queries
3. **Caching**: Use Redis for frequently accessed data (unread counts)
4. **Bulk Operations**: Use bulk inserts for mass notifications
5. **TTL**: Set expiry dates for non-critical notifications

## Next Steps

- [ ] Add authentication middleware
- [ ] Implement push notifications (FCM)
- [ ] Add WebSocket support for real-time delivery
- [ ] Integrate with Flutter app
- [ ] Add notification preferences (user settings)
- [ ] Implement notification templates
- [ ] Add analytics and tracking
