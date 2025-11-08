# Dispute System Documentation

## Overview
The dispute system allows users to raise disputes about properties, vehicles, bookings, payments, or other issues. Each dispute is tracked with status, priority, evidence, and complete history.

## Database Model

### Dispute Schema
Located in: `models/dispute.js`

**Key Fields:**
- **userId**: Reference to the user who created the dispute
- **itemType**: Type of item ('property', 'vehicle', 'booking', 'payment', 'other')
- **itemId**: Reference to the disputed item
- **title**: Short title of the dispute (max 200 characters)
- **description**: Detailed description (max 2000 characters)
- **category**: Dispute category
  - `payment_issue`
  - `service_quality`
  - `damaged_property`
  - `misleading_information`
  - `safety_concern`
  - `cancellation_dispute`
  - `refund_issue`
  - `other`
- **evidence**: Array of URLs to uploaded files (images, documents)
- **status**: Current status
  - `pending` (default)
  - `under_review`
  - `resolved`
  - `rejected`
  - `closed`
- **priority**: Priority level (`low`, `medium`, `high`, `urgent`)
- **response**: Admin/Support response details
- **resolution**: Final resolution details
- **statusHistory**: Complete history of status changes
- **metadata**: Additional info (IP, user agent, location)
- **timestamps**: createdAt, updatedAt (automatic)

## API Endpoints

Base URL: `/api/disputes`

### 1. Create Dispute
**POST** `/api/disputes`

**Authentication Required**: Yes

**Request Body:**
```json
{
  "itemType": "property",
  "itemId": "507f1f77bcf86cd799439011",
  "title": "Property not as described",
  "description": "The property photos showed a much larger space than reality...",
  "category": "misleading_information",
  "priority": "high",
  "evidence": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispute created successfully",
  "data": {
    "_id": "...",
    "userId": {...},
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z",
    ...
  }
}
```

---

### 2. Get User Disputes
**GET** `/api/disputes`

**Authentication Required**: Yes

**Query Parameters:**
- `status` (optional): Filter by status
- `category` (optional): Filter by category
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)

**Example:**
```
GET /api/disputes?status=pending&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "disputes": [...],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "pages": 3
    }
  }
}
```

---

### 3. Get Dispute by ID
**GET** `/api/disputes/:id`

**Authentication Required**: Yes

**Example:**
```
GET /api/disputes/507f1f77bcf86cd799439011
```

---

### 4. Update Dispute
**PUT** `/api/disputes/:id`

**Authentication Required**: Yes

**Note**: Only works if dispute status is `pending`

**Request Body (all fields optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description with more details",
  "priority": "urgent",
  "evidence": ["new-url.jpg"]
}
```

---

### 5. Delete Dispute
**DELETE** `/api/disputes/:id`

**Authentication Required**: Yes

**Note**: Only works if dispute status is `pending` (soft delete)

---

### 6. Get Dispute Statistics
**GET** `/api/disputes/statistics`

**Authentication Required**: Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "pending": 10,
    "under_review": 8,
    "resolved": 5,
    "rejected": 2,
    "closed": 0
  }
}
```

---

### 7. Get All Disputes (Admin)
**GET** `/api/disputes/all`

**Authentication Required**: Yes (Admin)

**Query Parameters:**
- `status` (optional): Filter by status
- `category` (optional): Filter by category
- `priority` (optional): Filter by priority
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

---

### 8. Update Dispute Status (Admin)
**PATCH** `/api/disputes/:id/status`

**Authentication Required**: Yes (Admin)

**Request Body:**
```json
{
  "status": "under_review",
  "notes": "Assigned to support team for investigation"
}
```

## Frontend Integration Guide

### Example: Create Dispute from Frontend

```javascript
const createDispute = async (disputeData) => {
  try {
    const response = await fetch('http://localhost:4000/api/disputes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` // or send via cookies
      },
      body: JSON.stringify({
        itemType: 'property',
        itemId: propertyId,
        title: 'Property not as described',
        description: 'Detailed description here...',
        category: 'misleading_information',
        priority: 'high',
        evidence: uploadedFileUrls,
        metadata: {
          userAgent: navigator.userAgent,
          // Add location if available
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Dispute created:', result.data);
      // Show success message to user
    } else {
      console.error('Failed to create dispute:', result.message);
    }
  } catch (error) {
    console.error('Error creating dispute:', error);
  }
};
```

### Example: Fetch User's Disputes

```javascript
const fetchUserDisputes = async (filters = {}) => {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 10,
    ...(filters.status && { status: filters.status }),
    ...(filters.category && { category: filters.category })
  });

  try {
    const response = await fetch(
      `http://localhost:4000/api/disputes?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching disputes:', error);
  }
};
```

## Status Flow

```
pending → under_review → resolved/rejected/closed
```

- **pending**: Initial state when dispute is created
- **under_review**: Admin/Support is investigating
- **resolved**: Dispute resolved in favor of user or other party
- **rejected**: Dispute rejected (invalid/no merit)
- **closed**: Dispute closed (no further action needed)

## Features Included

✅ Complete CRUD operations
✅ Authentication middleware integration
✅ Pagination support
✅ Status filtering
✅ Category-based filtering
✅ Priority levels
✅ Evidence attachment support
✅ Status history tracking
✅ User dispute statistics
✅ Soft delete functionality
✅ Comprehensive validation
✅ Population of related user data

## Next Steps (Optional Enhancements)

1. **File Upload**: Implement file upload endpoint for evidence
2. **Admin Middleware**: Create admin authentication middleware
3. **Email Notifications**: Send emails on status changes
4. **Real-time Updates**: Add WebSocket for live dispute updates
5. **Comments System**: Allow back-and-forth communication
6. **Escalation**: Auto-escalate high-priority disputes
7. **Analytics Dashboard**: Admin dashboard for dispute insights

## Database Indexes

The model includes optimized indexes for:
- User ID + Status (compound index)
- Item Type + Item ID (compound index)
- Creation date (descending)

These ensure fast queries even with large numbers of disputes.
