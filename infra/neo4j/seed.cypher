// Minimal seed: the Asakusa entity hierarchy (REQUIREMENTS.md 4.4.3).
// Kannon (deity) is a separate Entity from Senso-ji (site); Kaminarimon is a structure of Senso-ji.

MERGE (a:Entity {id: 'ent:asakusa'}) SET a.type = 'area', a.name_ja = '浅草', a.name_en = 'Asakusa';
MERGE (s:Entity {id: 'ent:sensoji'}) SET s.type = 'site', s.name_ja = '浅草寺', s.name_en = 'Sensō-ji';
MERGE (k:Entity {id: 'ent:kaminarimon'}) SET k.type = 'structure', k.name_ja = '雷門', k.name_en = 'Kaminarimon (Thunder Gate)';
MERGE (d:Entity {id: 'ent:kannon'}) SET d.type = 'deity', d.name_ja = '観音', d.name_en = 'Kannon';

MATCH (s:Entity {id: 'ent:sensoji'}), (a:Entity {id: 'ent:asakusa'}) MERGE (s)-[:PART_OF]->(a);
MATCH (k:Entity {id: 'ent:kaminarimon'}), (s:Entity {id: 'ent:sensoji'}) MERGE (k)-[:PART_OF]->(s);
MATCH (s:Entity {id: 'ent:sensoji'}), (d:Entity {id: 'ent:kannon'}) MERGE (s)-[:DEDICATED_TO]->(d);
