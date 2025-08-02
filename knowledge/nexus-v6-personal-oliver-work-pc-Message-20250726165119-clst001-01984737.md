The NEXUS DNA Auto-Chunking & Card Generation system is designed to automatically split various types of knowledge objects (text, images, audio, video, PDFs, links, data, messages, mixed media) into standalone, logically separated NEXUS DNA Cards, also known as "Snippets." Each card is fully tagged and contains metadata for easy reference and retrieval. Here's a breakdown of the key features and rules of the system:

### Key Features:
1. **Automatic Chunking**: 
   - Texts longer than 250 words are divided into separate cards for each 250-word section.
   - Logically recognizable sections (e.g., chapters, slides, emails, meetings, image series, datasets) are each treated as a single card.
   - Optional combination of chunking by logical unit and word count.

2. **Card Structure**:
   - Each card includes a unique identifier (UID), tags, context, cluster information, metadata, and a reference to the original source.
   - Cards are numbered and linked to the original object using `ParentUID`, `ChunkNr`, and `TotalChunks`.
   - A critical requirement is the inclusion of an original link reference (URL, path, drive link, or original file) for document access.

3. **Hierarchy and Access Control**:
   - Each object has fields for organizational hierarchy and access rights, specifying who can view or edit the object.
   - Hierarchy is represented either as a structured array or individual fields for organization, department, team, role, and person.
   - Access control fields include `role_access`, `person_access`, and `external_access`.

4. **Output Formats**:
   - Cards are output in both .md (Markdown) and .json formats for readability and machine processing, with identical fields in both formats.

5. **Verification and Compliance**:
   - Each card includes a self-check/verification status.
   - GDPR/MCP/Enterprise readiness is ensured with fields for access rights, roles, DPO, confidentiality, and retention policy.
   - Content rating is mandatory, with options like "neutral," "adult," "confidential," and "private."

6. **Additional Features**:
   - Related modalities and embedded objects are noted for complex objects.
   - Cards include creation and last updated timestamps in ISO8601 format.
   - A standard limit of 50 cards per object is set, with a warning in the root chunk if exceeded.
   - An index card is created for each object series, summarizing and organizing the cards.

### Example DNA Card Output:
The example provided demonstrates the structure of a DNA card in both .md and .json formats, including fields like UID, tags, hierarchy, access, and more. It also highlights the importance of maintaining a source link for compliance and verification purposes.

### Additional Rules for Calendar/Events:
- Recognize all persons, times, places, and activities mentioned.
- Create extensive search tags for each recognized entity.
- Add synonym tags for activities (e.g., "Essen" also tagged as "#Treffen," "#Meeting").

This system ensures efficient organization, retrieval, and compliance of knowledge objects, making it suitable for enterprise environments.