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
            <div style="margin-bottom: 16px;">
              <button class="btn" @click="toggleSingleCueMode">{{ singleCueMode ? '退出单句播放' : '进入单句播放' }}</button>
              <button class="btn" @click="playPrevCue">上一句</button>
              <button class="btn" @click="playNextCue">下一句</button>
              <input type="number" v-model="playCount" min="1" max="5" class="input input-bordered w-full max-w-xs">
              <span>设置播放次数 (0为无限)</span>
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
            <!-- 文件上传组件 -->
            <a-upload :before-upload="handleUpload" :show-upload-list="false" style="background: darkgrey;">
              <a-button>
                <upload-outlined></upload-outlined> 上传MP3文件
              </a-button>
            </a-upload>
            <!-- 文件列表表格 -->
            <a-table :data-source="fileList">
                <a-table-column title="文件名" dataIndex="name" key="name"></a-table-column>
                <a-table-column title="字幕" dataIndex="subtitleID" key="subtitleID" v-slot="{ text, record }">
                    <template v-if="record.subtitleID">
                        <a-button @click="viewSubtitle(record.subtitleID)">查看字幕</a-button>
                    </template>
                </a-table-column>
                <a-table-column title="操作" key="action" v-slot="{ record }">
                    <template v-for="(action, index) in fileListActions" :key="index">
                        <a-button @click="this[action.action](record)">{{ action.text }}</a-button>
                    </template>
                </a-table-column>
            </a-table>
          </a-layout-content>
        </a-col>
        <!-- 右边部分：显示字幕 -->
        <a-col :span="12">
          <a-layout-content style="margin: 0 16px; padding: 16px; overflow: auto;">
            <p 
              v-for="cue in cues.slice(0, currentCueIndex + 1)" 
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
</style>

<script>

import Plyr from 'plyr';
import { WebVTT } from 'vtt.js';
import { PieChartOutlined } from '@ant-design/icons-vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import { FileOutlined } from '@ant-design/icons-vue';
import { Button as AButton } from 'ant-design-vue';
import { openDB } from 'idb';


const player = new Plyr('#player', {captions: {active: true}});

async function initDB() {
  const db = await openDB('myAppDB', 1, {
    upgrade(db) {
      db.createObjectStore('files', { keyPath: 'id' });
    },
  });
  return db;
}


export default {
  components: {
    PieChartOutlined,
    UploadOutlined,
    FileOutlined,
    AButton,
  },
  mounted() {
    this.player = new Plyr('#player', {
      /* options */
    });
    //this.parseSubtitles();
    this.player.on('timeupdate', this.updateSubtitle);
  },
  beforeDestroy() {
    // 销毁播放器实例
    this.player.destroy();
    this.player.off('timeupdate', this.updateSubtitle);
  },
  data() {
    return {
      lyrics: 'loading', // 存储歌词内容
      lyricsUrl:'',
      collapsed:false,
      selectedKeys:[],
      file:'',
      fileUrl:'',
      lock:false,
      apiKey: '',
      cues: [],
      currentSubtitle: 'loading',
      currentPlayTime: 0,
      fileList: [], // 存储文件列表
      singleCueMode: true, // 是否处于单句播放模式
      currentCueIndex: 0, // 当前播放的句子的索引
      playCount: 3, // 播放次数
      singleCuePlayCount: 0, // 当前句子已播放的次数
      columns: [ // 表格列的配置
        {
          title: '文件名',
          dataIndex: 'name',
        },
        {
          title: '操作',
          dataIndex: 'action',
          render: (text, record) => {
            console.log("render");
            return h('span', [
              h('AButton', { onClick: () => this.handleDelete(record) }, '删除'),
              h('AButton', { onClick: () => this.handlePlay(record) }, '播放')
            ]);
          },
        },
      ],
      fileListActions: [
          { text: '删除', action: 'handleDelete' },
          { text: '播放', action: 'handlePlay' },
          { text: '生成字幕', action: 'generateSubtitleForFile' },
      ],
    };
  },
  watch: {
    apiKey(newValue) {
      localStorage.setItem('apiKey', newValue);
    },
    fileList: {
        handler(newFileList) {
            localStorage.setItem('fileList', JSON.stringify(newFileList));
        },
        deep: true
    },
  },
  created() {
    this.apiKey = localStorage.getItem('apiKey') || '';
    const savedFileList = localStorage.getItem('fileList');
    if (savedFileList) {
        this.fileList = JSON.parse(savedFileList);
    }
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
      if (this.lock === true) {
        return
      }else{
        this.lock = true
      }
      console.log("--------------------------------");
      console.log("current time:"+this.player.currentTime);
      console.log("current cue index:"+this.currentCueIndex);
      console.log("current cue starttime:"+this.cues[this.currentCueIndex].startTime);
      console.log("current cue endtime:"+this.cues[this.currentCueIndex].endTime);
      console.log("singleCuePlayCount: "+ this.singleCuePlayCount);
      // 如果当前处于单句播放模式
      if ( (this.singleCueMode)  && (this.player.currentTime> this.cues[this.currentCueIndex].endTime) ){
        // 如果设置为无限次播放，将播放器的当前时间设置为当前句的开始时间，以实现循环播放
        if (this.playCount === 0 ) {
          console.log("this.player.currentTime******************************0");
          this.player.currentTime = this.cues[this.currentCueIndex].startTime;
          this.lock = false
          return
        }

        // 每次调用时，对当前句的播放次数进行递增
        this.singleCuePlayCount++;
        console.log("2");
        
        // 判断是否已达到用户设置的播放次数或设置为无限次播放
        if (this.singleCuePlayCount === this.playCount) {
            console.log("**************************3");
            this.singleCuePlayCount = 0;
        } else {
            // 如果未达到设置的播放次数，将播放器的当前时间设置为当前句的开始时间，以实现循环播放
            console.log("this.player.currentTime******************************4");
            this.player.currentTime = this.cues[this.currentCueIndex].startTime;
            this.lock = false
            return
        }
      }

      console.log("5");
      let currentTime = this.player.currentTime;
      let currentCue = this.cues.find(cue => currentTime >= cue.startTime && currentTime < cue.endTime);
      if (currentCue) {
        this.currentSubtitle = currentCue.text;
        this.currentCueIndex = this.cues.indexOf(currentCue);
      } else {
        this.currentSubtitle = '';
      }
      this.lock = false
      return
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
    toggleSingleCueMode() {
      this.singleCueMode = !this.singleCueMode;
      if (!this.singleCueMode) {
        this.currentCueIndex = -1;
      }
    },
    
    playPrevCue() {
      if (this.currentCueIndex > 0) {
        this.currentCueIndex--;
        console.log("this.player.currentTime******************************playPrev")
        this.player.currentTime = this.cues[this.currentCueIndex].startTime;
        this.singleCuePlayCount = 0;
      }
    },
    
    playNextCue() {
      if (this.currentCueIndex < this.cues.length - 1) {
        this.currentCueIndex++;
        console.log("this.player.currentTime******************************playNextCue")
        this.player.currentTime = this.cues[this.currentCueIndex].startTime;
        this.singleCuePlayCount = 0;
      }
    },
    seekToCue(cue) {
      this.currentCueIndex = this.cues.indexOf(cue);
      console.log("this.player.currentTime******************************seekToCue")
      this.player.currentTime = cue.startTime;
      this.singleCuePlayCount = 0;
    },
    isCurrentCue(cue) {
      return this.currentCueIndex === this.cues.indexOf(cue);
    },
    async handleUpload(file) {
      const db = await initDB();
      const fileId = Date.now().toString();
      await db.put('files', {
        id: fileId,
        file: file,
      });
      this.fileList.push({
        key: file.uid,
        name: file.name,
        url: fileId, // 使用 fileId 作为URL
      });
      return false; // 阻止文件上传到服务器
    },
    handleDelete(record) {
      this.fileList = this.fileList.filter(item => item.key !== record.key);
    },
    async handlePlay(record) {
      const db = await initDB();
      const fileEntry = await db.get('files', record.url); // 使用 fileId 从 idb 中获取文件
      const blobURL = URL.createObjectURL(fileEntry.file);
      const audio = document.getElementById('player');
      audio.src = blobURL;

      const subtitlefileEntry = await db.get('files', record.subtitleID); // 使用 fileId 从 idb 中获取文件
      this.lyrics = subtitlefileEntry.file
      
      audio.play();
      this.parseSubtitles()
    },
    async getFileFromBlobUrl(blobUrl) {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new File([blob], "filename.mp3", { type: 'audio/mp3' });
    },
    async viewSubtitle(subtitleID) {
      const db = await initDB();
      console.log(subtitleID);
      const fileEntry = await db.get('files', subtitleID); // 使用 fileId 从 idb 中获取文件
      if (typeof fileEntry.file === 'string') {
          let blob = new Blob([fileEntry.file], { type: 'text/plain' });
          const blobURL = URL.createObjectURL(blob);
          console.log(blobURL);
          window.open(blobURL, '_blank');
      } else {
          console.error("Unexpected file type");
      }
    },
    async generateSubtitleForFile(record) {
      const transcribe = (apiKey, file, language, response_format) => {
          const url = 'https://api.openai.com/v1/audio/transcriptions'
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

      const db = await initDB();
      const fileEntry = await db.get('files', record.url); // 使用 fileId 从 idb 中获取文件
      const blobURL = URL.createObjectURL(fileEntry.file);
      console.log(blobURL);
      const file = await this.getFileFromBlobUrl(blobURL);
      
      const transcription = await transcribe(this.apiKey, file, 'en', 'vtt');
      const subtitleContent = transcription;
      console.log(subtitleContent);

      const fileId = Date.now().toString();
      await db.put('files', {
        id: fileId,
        file: subtitleContent,
      });

      const fileIndex = this.fileList.findIndex(item => item.key === record.key);
      if (fileIndex !== -1) {
          this.fileList[fileIndex].subtitleID = fileId;
      }
      
    }

  },
};
</script>
