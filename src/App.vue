<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible>
      <!-- <div class="logo" /> -->
      <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
        <a-menu-item key="1">
          <pie-chart-outlined />
          <span>Logo</span>
        </a-menu-item>
        <a-menu-item key="9" onclick="my_modal_1.showModal()">
          <file-outlined />
          <span>设置</span>
          <dialog id="my_modal_1" class="modal">
            <form method="dialog" class="modal-box">
              <h3 class="font-bold text-lg">OpenAI Key</h3>
              <input type="text" v-model="apiKey" placeholder="sk-xxxx" class="input input-bordered w-full max-w-xs" />
              <div class="modal-action">
                <!-- if there is a button in form, it will close the modal -->
                <button class="btn">Save</button>
              </div>
            </form>
          </dialog>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout style="background: #141414;">
      <a-row style="min-height: 100vh;">
        <!-- 左边部分 -->
        <a-col :span="12">
          <!-- 上面部分：播放器 -->
          <a-layout-content style="margin: 0 16px; background: #141414; min-height: 50vh;">
            <div>
              <audio id="player" playsinline controls></audio>
            </div>
          </a-layout-content>

          <!-- 下面部分：文件选择和按钮 -->
          <a-layout-content style="margin: 16px;min-height: 50vh;">
            <div>
              <input type="file" accept="audio/mp3" class="file-input w-full max-w-xs" @change="handleFileSelect">
            </div>
            <div style="margin-top: 16px;">
              <button class="btn" @click="generateLyrics">生成字幕</button>
            </div>
          </a-layout-content>
        </a-col>
        <div class="vertical-divider"></div>
        <!-- 右边部分：显示字幕 -->
        <a-col :span="12">
          <a-layout-content style="margin: 0 16px; padding: 16px; overflow: auto;">
            <p 
              v-for="cue in cues" 
              :key="cue.id"
              :class="{ 'highlighted': isCurrentCue(cue) }"
              @click="seekToCue(cue)"
            >
              {{ cue.text }}
            </p>
          </a-layout-content>
        </a-col>

      </a-row>
    </a-layout>
  </a-layout>
</template>

<style >
@import "plyr/dist/plyr.css";
#components-layout-demo-side .logo {
  height: 32px;
  margin: 16px;
  background: rgba(255, 255, 255, 0.3);
}

.site-layout .site-layout-background {
  background: #fff;
}
[data-theme='dark'] .site-layout .site-layout-background {
  background: #141414;
}

.highlighted {
  color: #ff0000;  /* 你可以选择你喜欢的颜色 */
  font-weight: bold;
}
.vertical-divider {
  width: 1px;  /* 分割线的宽度 */
  background-color: #cccccc;  /* 分割线的颜色 */
  height: 100%;  /* 使分割线占据整个容器的高度 */
  flex-shrink: 0;  /* 确保分割线不会缩小 */
}


</style>

<script>

import Plyr from 'plyr';
import { WebVTT } from 'vtt.js';

const player = new Plyr('#player', {captions: {active: true}});

export default {
  mounted() {
    this.player = new Plyr('#player', {
      /* options */
    });
    //this.parseSubtitles();
  },
  beforeDestroy() {
    // 销毁播放器实例
    this.player.destroy();
  },
  data() {
    return {
      lyrics: 'loading', // 存储歌词内容
      lyricsUrl:'',
      file:'',
      fileUrl:'',
      apiKey: '',
      cues: [],
      currentSubtitle: 'loading',
      currentPlayTime: 0,
    };
  },
  watch: {
    apiKey(newValue) {
      localStorage.setItem('apiKey', newValue);
    },
  },
  created() {
    this.apiKey = localStorage.getItem('apiKey') || '';
  },
  methods: {
    parseSubtitles() {
      let parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
      parser.oncue = cue => {
        this.cues.push(cue);
      };
      parser.parse(this.lyrics);
      parser.flush();

      this.player.on('timeupdate', (event) => {
        this.currentPlayTime = this.player.currentTime;
        this.updateSubtitle();
      });
    },
    updateSubtitle() {
      console.log("updateSubtitle:"+this.player.currentTime);
      let currentTime = this.player.currentTime;
      let currentCue = this.cues.find(cue => currentTime >= cue.startTime && currentTime <= cue.endTime);
      console.log("currentCue:"+ currentCue.startTime);
      console.log("currentCue:"+ currentCue.endTime);
      console.log("currentCue:"+ currentCue.text);
      this.currentSubtitle = currentCue ? currentCue.text : '';
    },
    handleFileSelect(event) {
      this.file = event.target.files[0];
      this.fileUrl = URL.createObjectURL(this.file);
      this.player.source = {
          type: 'audio',
          title: 'Example title',
          sources: [
            {
              src: this.fileUrl,
              type: 'audio/mp3',
            }
          ],
        };
    },
    generateLyrics() {
      const url = 'https://api.openai.com/v1/audio/transcriptions'

      const transcribe = (apiKey, file, language, response_format) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('model', 'whisper-1')
          formData.append('response_format', response_format || 'verbose_json')
          if (language) {
              formData.append('language', language)
          }

          const headers = new Headers()
          headers.append('Authorization', `Bearer ${apiKey}`)

          return fetch(url, {
              method: 'POST',
              body: formData,
              headers: headers
          }).then(response => {
              console.log(response)
              // Automatically handle response format
              if (response_format === 'json' || response_format === 'verbose_json') {
                  return response.json()
              } else {
                  return response.text()
              }
          }).catch(error => console.error(error))
      }

      const language = 'en'
      const response_format = 'vtt'
      const response = transcribe(this.apiKey, this.file, language, response_format)

      response.then(transcription => {
          this.lyrics = transcription
          let blob = new Blob([this.lyrics], { type: 'text/plain' });
          const lyricsUrl = URL.createObjectURL(blob);
          this.parseSubtitles();
      });
    },
    seekToCue(cue) {
      this.player.currentTime = cue.startTime;
    },
    isCurrentCue(cue) {
      let isCurrent = this.currentPlayTime >= cue.startTime && this.currentPlayTime <= cue.endTime;
  
      if (isCurrent) {
        console.log('Current Cue:', cue.text);
      }
      
      return isCurrent;
    },
  },
};
</script>
