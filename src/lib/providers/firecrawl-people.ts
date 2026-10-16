import { searchCompaniesByPeople } from "@/lib/vendors/firecrawl/discovery"
import { dbCreditLedger, firecrawlClientDeps } from "@/lib/vendors/firecrawl/runtime"
import type { CompanyDiscoveryProvider } from "./types"

/**
 * Company discovery through Firecrawl people search (PEOPLE_DATA_PROVIDER=firecrawl),
 * bound to the gtm_vendor_usage ledger and, in fixture mode, the offline transport.
 * The logic is in vendors/firecrawl/discovery.ts.
 */
export const firecrawlCompanyProvider: CompanyDiscoveryProvider = {
  key: "firecrawl",
  searchCompanies: (query, context) =>
    searchCompaniesByPeople(query, { ledger: dbCreditLedger(context), deps: firecrawlClientDeps() }),
}
