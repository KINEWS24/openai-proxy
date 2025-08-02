The NEXUS DNA Auto-Chunking & Card Generation Master Formula is a comprehensive framework designed to automatically process and organize various types of knowledge objects (such as text, images, audio, video, PDFs, links, data, messages, and mixed content) into distinct, logically separated NEXUS DNA Cards, also known as "Snippets." Each card is fully tagged and contains metadata to ensure efficient management and retrieval.

### Key Features of the Formula:

1. **Automatic Chunking:**
   - Text and multimodal content exceeding 250 words are divided into separate cards, each containing 250 words.
   - Logically recognizable sections (e.g., chapters, slides, emails, meetings, image series, datasets) are each converted into a single card.
   - Optional combination of chunking by logical unit and word count.

2. **Card Structure:**
   - Each card includes a unique identifier (UID), tags, context, cluster information, metadata, and a reference to the original source.
   - Cards are numbered and linked to their parent object for easy navigation and understanding of their place within the larger work.
   - A system-critical original link reference is mandatory for compliance and data ownership verification.

3. **Hierarchy and Access Control:**
   - Each object includes fields for organizational hierarchy and access rights, specifying who can view or edit the content.
   - Access is controlled by roles, individual permissions, and external access rights.

4. **Output Formats:**
   - Cards are output in both Markdown (.md) for readability and Retrieval-Augmented Generation (RAG), and JSON (.json) for API integration and automation, ensuring field parity across formats.

5. **Verification and Compliance:**
   - Each card ends with a verification status, indicating whether it has been checked or needs further review.
   - GDPR and enterprise readiness are ensured with fields for access rights, roles, Data Protection Officer (DPO) approval, confidentiality, and retention policies.

6. **Content Rating and Related Modalities:**
   - A mandatory content rating field categorizes the content as neutral, adult, confidential, or private.
   - Complex objects include related modalities and embedded objects for comprehensive representation.

7. **Timestamping and Limits:**
   - Cards include creation and last updated timestamps in ISO8601 format.
   - A standard limit of 50 cards per object is set, with a warning issued if the limit is reached.

8. **Index Cards:**
   - An index card is created for each series of objects (e.g., projects, meetings) to provide an overview and meta-information.

### Example DNA Card Output:

The example provided illustrates the structure of a DNA card in both Markdown and JSON formats, highlighting fields such as UID, tags, title, summary, key points, hierarchy, access rights, GDPR compliance, and more. The card also includes a verification status and a reference to the original source.

### Additional Features for Calendar/Events:

For calendar-related content, the system detects and tags all relevant entities such as people, times, places, and activities. It generates extensive search tags and synonym tags to enhance searchability and context understanding.

Overall, the NEXUS DNA Auto-Chunking & Card Generation Master Formula provides a robust framework for organizing and managing diverse content types, ensuring compliance, accessibility, and efficient retrieval.