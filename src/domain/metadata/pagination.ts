/**
 * Maximum number of metadata items requested per page when paginating against
 * the DHIS2 API. Keeps requests bounded regardless of the UI selection so the
 * server is not hammered with unbounded page sizes.
 */
export const MAX_PAGE_SIZE = 200;
