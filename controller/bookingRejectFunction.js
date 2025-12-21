
/**
 * Reject/Decline booking (Owner only)
 * POST /api/owner/bookings/:id/reject
 */
export const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.userId; // From auth middleware

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Verify booking belongs to this owner
        if (booking.ownerId.toString() !== ownerId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to reject this booking' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot reject booking with status: ${booking.status}` });
        }

        // Update booking status to cancelled
        booking.status = 'cancelled';
        await booking.save();

        console.log(`❌ [REJECTED] Booking ${booking._id} by owner ${ownerId}`);

        res.status(200).json({ success: true, message: 'Booking rejected' });
    } catch (error) {
        console.error('❌ [REJECT ERROR]', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};
