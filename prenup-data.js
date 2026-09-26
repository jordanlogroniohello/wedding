/**
 * PRENUP TIMELINE STUDIO — Project Data
 * ======================================
 * Angelica & Jordan | September 22, 2026
 *
 * Edit this file to add/remove/modify scenes, references, and timeline content.
 * The UI reads from this object — no other file needs to change for content updates.
 *
 * TIME FORMAT: All times are in seconds (e.g., 1:30 = 90)
 *
 * PRIORITY VALUES: 'must-have' | 'would-love' | 'optional'
 */

const projectData = {

    // ─── COUPLE & EVENT ───────────────────────────────────────────────
    couple: {
        name1: 'Angelica',
        name2: 'Jordan',
        prenupDate: 'September 22, 2026',
        weddingDate: 'November 27, 2026',
        location: 'Ninoy Aquino Parks and Wildlife Center'
    },

    // ─── SONG ─────────────────────────────────────────────────────────
    song: {
        title: 'A Thousand Years',
        artist: 'John Michael Howell, JVKE & ZVC',
        duration: 181,  // 3:01 — auto-updates when audio loads
        audioSrc: 'audio/a-thousand-years.mp3'
    },

    // ─── MUSIC SECTIONS ───────────────────────────────────────────────
    // Mapped by ear from the actual MP3 (3:01.47).
    musicSections: [
        { id: 'intro',        name: 'INTRO',              startTime: 0,     endTime: 10.8  },
        { id: 'verse1',       name: 'VERSE 1',            startTime: 10.8,  endTime: 38    },
        { id: 'prechorus1',   name: 'PRE-CHORUS 1',       startTime: 38,    endTime: 48    },
        { id: 'chorus1',      name: 'CHORUS 1',           startTime: 48,    endTime: 70    },
        { id: 'breath1',      name: 'BREATH',             startTime: 70,    endTime: 73    },
        { id: 'verse2',       name: 'VERSE 2',            startTime: 73,    endTime: 99    },
        { id: 'prechorus2',   name: 'PRE-CHORUS 2',       startTime: 99,    endTime: 109   },
        { id: 'chorus2',      name: 'CHORUS 2',           startTime: 109,   endTime: 130   },
        { id: 'transition',   name: 'TRANSITION',         startTime: 130,   endTime: 133   },
        { id: 'bridge',       name: 'BRIDGE',             startTime: 133,   endTime: 154   },
        { id: 'finalbuild',   name: 'FINAL BUILD',        startTime: 154,   endTime: 159   },
        { id: 'finalchorus',  name: 'FINAL CHORUS',       startTime: 159,   endTime: 178   },
        { id: 'outro',        name: 'OUTRO',              startTime: 178,   endTime: 181   },
    ],

    // ─── VIDEO SCENES ─────────────────────────────────────────────────
    // Each scene appears on the VIDEO track and has a clickable detail panel.
    scenes: [
        {
            id: 'scene-011',
            name: 'Verse 1 to Chorus Storyboard',
            startTime: 11,
            endTime: 48,
            musicCue: 'Verse 1 \u2192 Pre-Chorus 1 \u2192 Chorus 1',
            visualIdea: null,
            notes: null,
            referenceImage: 'assets/timeline/images/reference-verse1-storyboard.png',
            referenceVideo: null,
            whatWeLike: null,
            priority: 'must-have',
            thumbnail: 'assets/timeline/images/reference-verse1-storyboard.png'
        },
        {
            id: 'scene-032',
            name: 'Reference at 0:32',
            startTime: 32,
            endTime: 38,
            musicCue: 'Verse 1',
            visualIdea: null,
            notes: null,
            referenceImage: null,
            referenceVideo: 'assets/timeline/videos/reference-032.mov',
            whatWeLike: null,
            priority: 'must-have',
            thumbnail: null
        },
        {
            id: 'scene-073',
            name: 'Verse 2 to Chorus Storyboard',
            startTime: 73,
            endTime: 109,
            musicCue: 'Verse 2 \u2192 Pre-Chorus 2 \u2192 Chorus 2',
            visualIdea: null,
            notes: null,
            referenceImage: 'assets/timeline/images/reference-verse2-storyboard.png',
            referenceVideo: null,
            whatWeLike: null,
            priority: 'must-have',
            thumbnail: 'assets/timeline/images/reference-verse2-storyboard.png'
        },
        {
            id: 'scene-132',
            name: 'Reference at 1:32',
            startTime: 92,
            endTime: 99,
            musicCue: 'Pre-Chorus 2 \u2014 going high note',
            visualIdea: null,
            notes: null,
            referenceImage: null,
            referenceVideo: 'assets/timeline/videos/reference-032.mov',
            whatWeLike: 'Same energy as the 0:32 reference \u2014 high note moment.',
            priority: 'must-have',
            thumbnail: null
        },
        {
            id: 'scene-240',
            name: 'Almost Kiss / Save The Date',
            startTime: 160,
            endTime: 170,
            musicCue: 'Final Chorus',
            visualIdea: 'Angelica and Jordan lean in close, silhouetted against warm backlight. Just before their lips meet \u2014 hard cut to the Save The Date text/label. The kiss never lands on screen. The cut IS the moment.',
            notes: null,
            referenceImage: 'assets/timeline/images/reference-240-kiss-savethedate.png',
            referenceVideo: null,
            whatWeLike: 'The silhouette framing and warm backlight. The intimacy of the moment right before a kiss \u2014 used as a dramatic cut point to reveal the Save The Date.',
            priority: 'must-have',
            thumbnail: 'assets/timeline/images/reference-240-kiss-savethedate.png'
        }
    ],

    // ─── CUES ─────────────────────────────────────────────────────────
    cues: [],

    // ─── REFERENCES ───────────────────────────────────────────────────
    // Reference media for the References moodboard view.
    // category: 'photo' | 'video' | 'edit'
    references: [
        {
            id: 'ref-main',
            sceneId: null,
            category: 'video',
            title: 'Main Reference \u2014 Overall Feel & Direction',
            thumbnail: null,
            src: 'assets/timeline/videos/main-reference.mp4',
            type: 'video',
            whatWeLike: 'Cinematic, slow-paced, with wide shots and a moody teal-green color grade — intimate but not close-up. This is the overall reference for the feel, pacing, and visual direction we love for the entire prenup video.'
        }
    ]
};
