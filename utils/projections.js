/**
 * User Field Projections - Centralized Constants
 * 
 * Prevents data over-fetching by defining explicit field lists.
 * Never inline projection strings - use these constants.
 * 
 * Benefits:
 * - Single source of truth
 * - Prevents typos
 * - Easier to audit
 * - Consistent across codebase
 */

/**
 * PUBLIC_USER_FIELDS
 * Minimal info for public display (reviews, comments, listings)
 * Use in: populate('userId', PUBLIC_USER_FIELDS)
 */
export const PUBLIC_USER_FIELDS = 'name avatar';

/**
 * AUTH_USER_FIELDS
 * Info for authenticated user viewing their own profile
 * Use in: User.findById(userId).select(AUTH_USER_FIELDS)
 */
export const AUTH_USER_FIELDS = 'name email phone avatar banner bio kyc Country State City';

/**
 * FAVOURITES_USER_FIELDS
 * Fields needed for favourite operations
 */
export const FAVOURITES_USER_FIELDS = 'favourites name avatar';

/**
 * VISITED_PROPERTIES_FIELDS
 * Fields for visited properties tracking
 */
export const VISITED_PROPERTIES_FIELDS = 'visitedProperties name avatar';

/**
 * VISITED_VEHICLES_FIELDS
 * Fields for visited vehicles tracking
 */
export const VISITED_VEHICLES_FIELDS = 'visitedVehicles name avatar';

/**
 * BOOKINGS_USER_FIELDS
 * Fields for booking operations
 */
export const BOOKINGS_USER_FIELDS = 'bookings name email phone avatar';

/**
 * EARNINGS_USER_FIELDS
 * Fields for owner earnings dashboard
 */
export const EARNINGS_USER_FIELDS = 'TotalEarnings AvailableBalance ActiveListings TotalPropertyListings TotalVehicleListings name email';

/**
 * RECOMMENDED_USER_FIELDS
 * Fields for recommendation algorithm
 */
export const RECOMMENDED_USER_FIELDS = 'favourites.properties favourites.vehicles visitedProperties visitedVehicles';

/**
 * SEARCH_USER_FIELDS
 * Fields for search personalization
 */
export const SEARCH_USER_FIELDS = 'favourites bookings';

/**
 * CHAT_USER_FIELDS
 * Fields for chat operations
 */
export const CHAT_USER_FIELDS = 'propertyOwners name avatar';

/**
 * TOKEN_VERSION_FIELD
 * Only for logout-all operations
 */
export const TOKEN_VERSION_FIELD = 'tokenVersion';

/**
 * ADMIN_USER_FIELDS
 * Extended fields for admin operations ONLY
 * Use with extreme caution in admin-guarded routes
 */
export const ADMIN_USER_FIELDS = 'name email phone avatar kyc createdAt updatedAt isAdmin ActiveListings TotalBookings';

/**
 * Helper: Check if query uses .lean()
 * If yes, MUST use explicit .select() as schema transforms are bypassed
 */
export const requiresExplicitSelect = (query) => {
    return query._mongooseOptions?.lean === true;
};

export default {
    PUBLIC_USER_FIELDS,
    AUTH_USER_FIELDS,
    FAVOURITES_USER_FIELDS,
    VISITED_PROPERTIES_FIELDS,
    VISITED_VEHICLES_FIELDS,
    BOOKINGS_USER_FIELDS,
    EARNINGS_USER_FIELDS,
    RECOMMENDED_USER_FIELDS,
    SEARCH_USER_FIELDS,
    CHAT_USER_FIELDS,
    TOKEN_VERSION_FIELD,
    ADMIN_USER_FIELDS
};
