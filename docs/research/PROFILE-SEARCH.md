# Profile search sources and behavior

The school dropdown uses currently operating institutions from the U.S. Department of Education College Scorecard institution-level download (May 2025): https://catalog.data.gov/dataset/college-scorecard. It keeps only institution name, city, and state. This is a search aid, not a school verification service. People can enter any school, including schools outside the United States.

The job-title dropdown uses Proofline's existing O*NET 31.0 occupation catalog plus a short list of common titles. The occupation catalog's source and license appear in `lib/resume/onet-catalog.json`. Degree and field labels are small Proofline-curated lists. Every dropdown permits free text; picking a label does not create a credential, work claim, or confirmed fact on its own.

The server returns at most eight options per search and never sends the full school or occupation catalogs to the browser.
