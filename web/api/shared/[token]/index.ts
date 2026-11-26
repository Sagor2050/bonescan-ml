import { handleSharedRequest } from '../../../server/sharedReports.js'
import { supabaseShareStore } from '../../../server/supabaseShareStore.js'

// GET /api/shared/:token: the reports a share link covers (S10.3). Every other
// method is refused.
const handle = (request: Request) =>
  handleSharedRequest(request, supabaseShareStore)

// The writes are listed so that they reach the 405 answer too.
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
}
