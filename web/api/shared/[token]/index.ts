import { handleSharedRequest } from '../../../server/sharedReports.js'
import { supabaseShareStore } from '../../../server/supabaseShareStore.js'

// GET /api/shared/:token: the reports a share link covers (S10.3). Every other
// method is refused.
export default {
  fetch: (request: Request) => handleSharedRequest(request, supabaseShareStore),
}
