import { handleSharedRequest } from '../../../../../server/sharedReports.js'
import { supabaseShareStore } from '../../../../../server/supabaseShareStore.js'

// GET /api/shared/:token/reports/:index/file: one shared report's original PDF,
// streamed through here so its storage path, which names the owner's account,
// never leaves the server (S10.3). Every other method is refused.
export default {
  fetch: (request: Request) => handleSharedRequest(request, supabaseShareStore),
}
