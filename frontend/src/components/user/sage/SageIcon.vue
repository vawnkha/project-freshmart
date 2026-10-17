<script setup>
// Approved prototype line icons; static geometry only, never HTML from API.
const props = defineProps({ name: { type: String, required: true } });
const glyphs = {
  "search": [
    {
      "tag": "circle",
      "attrs": {
        "cx": "11",
        "cy": "11",
        "r": "7.5"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "m20.5 20.5-4.2-4.2"
      }
    }
  ],
  "menu": [
    {
      "tag": "path",
      "attrs": {
        "d": "M4 7h16"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M4 12h16"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M4 17h16"
      }
    }
  ],
  "user": [
    {
      "tag": "circle",
      "attrs": {
        "cx": "12",
        "cy": "8",
        "r": "4"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M4 22v-3a8 8 0 0 1 16 0v3"
      }
    }
  ],
  "heart": [
    {
      "tag": "path",
      "attrs": {
        "d": "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      }
    }
  ],
  "bag": [
    {
      "tag": "path",
      "attrs": {
        "d": "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M3 6h18"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M16 10a4 4 0 0 1-8 0"
      }
    }
  ],
  "plus": [
    {
      "tag": "path",
      "attrs": {
        "d": "M5 12h14"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M12 5v14"
      }
    }
  ],
  "arrow-right": [
    {
      "tag": "path",
      "attrs": {
        "d": "M5 12h14"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "m12 5 7 7-7 7"
      }
    }
  ],
  "arrow-up-right": [
    {
      "tag": "path",
      "attrs": {
        "d": "M7 7h10v10"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M7 17 17 7"
      }
    }
  ],
  "sliders": [
    {
      "tag": "path",
      "attrs": {
        "d": "M21 4h-7"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M10 4H3"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M21 12h-9"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M8 12H3"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M21 20h-5"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M12 20H3"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M14 2v4"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M8 10v4"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M16 18v4"
      }
    }
  ],
  "package": [
    {
      "tag": "path",
      "attrs": {
        "d": "m7.5 4.27 9 5.15"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "m3.3 7 8.7 5 8.7-5"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M12 22V12"
      }
    }
  ],
  "leaf": [
    {
      "tag": "path",
      "attrs": {
        "d": "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
      }
    },
    {
      "tag": "path",
      "attrs": {
        "d": "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
      }
    }
  ],
  "message": [
    {
      "tag": "path",
      "attrs": {
        "d": "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
      }
    }
  ]
};
</script>
<template>
  <svg class="sage-line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <component v-for="(part, index) in glyphs[props.name] || []" :key="index" :is="part.tag" v-bind="part.attrs" />
  </svg>
</template>
