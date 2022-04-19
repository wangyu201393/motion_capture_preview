import './App.css';
import React from 'react';
import { Upload, Layout, Dialog, Button, message, Progress, Drawer } from 'tdesign-react';
import { CloudUploadIcon, UploadIcon, LoadingIcon, FullscreenIcon, MenuFoldIcon, MenuUnfoldIcon } from 'tdesign-icons-react';
import 'tdesign-react/es/style/index.css';
// import Crypto from 'crypto-js';
// import Buffer from 'buffer';

const { Header, Content } = Layout;
const MAX_TIME = 30;
//const API = 'http://9.134.88.214:3001/api/upload';
const API = 'http://10.40.38.60:8002';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      title: 'Motion Capture Portal',
      dlgWidth: 620,
      dlgVisible: false,
      entryVisible: true,
      uploadProgress: 0,
      analyseProgress: 0,
      pg1Visible: false,
      pg2Visible: false,
      waiting: false,
      resVideoURL: '',
      orgVideoURL: '',
      resURL: '',
      expand: false,
      hideOrigin: true,
      resVideoReady: false,
      orgVideoReady: false,
      offsetX: 0,
      urlHead: '',
      taskId: 0,
      download: '',
      drawerVisible: false,
    };

    window.addEventListener('resize', () => {
      this.computeOffset();
    })
  }

  handleChange(file) {
    console.log(file)
    console.log('onChange');
    this.setState({
      entryVisible: false,
      dlgVisible: false,
      pg1Visible: true,
      expand: false,
      orgVideoURL: '',
      resVideoURL: '',
      hideOrigin: true,
    });
  }

  handleFail( file ) {
    // message.error(`视频 ${file.name} 上传失败`);
  }

  handleSuccess() {
    this.setState({files: []});
    // message.success(`视频 ${file.name} 上传成功`);
    setTimeout(() => {
      console.log('Analyzing...')
      this.analyzing();
    }, 800);
  }

  invalidButton() {
    message.warning(`暂无可下载资源`);
  }

  analyseError() {
    console.log('Analyse Error');
    message.error(`Analyse Error`);
  }

  beforeUpload(file) {
    console.log(file);
    console.log("----beforeUpload");
    return new Promise((resolve, reject) => {
      let video = document.createElement('video');
      video.src = file.url;
      video.onloadedmetadata = () => {
        console.log("local video onloadedmetadata")
        if (video.duration > MAX_TIME) {
          message.warning(`上传的视频时长不能超过${MAX_TIME}秒`);
          reject(new Error(false));
        }
        this.uploadData(file);
        resolve(true);
      }
      video.onerror = () => {
        this.setState({
          title: '视频上传失败',
          waiting: false,
        });
        message.error(`不支持的视频编码格式, 推荐使用H.264`);
        setTimeout(() => {
          this.setState({
            title: 'Motion Capture Portal',
            pg1Visible: false,
            entryVisible: true,
          })
        }, 3000);
      }
    });
  }

  onProgress(val) {
    this.setState({progress: val})
  }

  uploadData(file) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', API, true);

    xhr.onload = () => {
      this.handleSuccess(file);
    }
    xhr.onerror = () => {
      this.handleFail(file)
    }
    this.setState({
      title: '视频上传中',
      waiting: true
    });
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {  
        let res = JSON.parse(xhr.response)
        console.log(res);
        if (!res.res_url || res.url === '') {
          this.analyseError();
        }
        this.setState({resURL: res.res_url});
      }
    }
    xhr.upload.onprogress = (e) => {
      this.setState({uploadProgress: Number(parseInt(e.loaded / e.total * 100))});
      console.log(this.state.uploadProgress);
      if (this.state.uploadProgress === 100) {
        this.setState({
          title: '视频上传完成',
          waiting: false
        });
      }
    };
    // read local Video File
    const reader = new FileReader();
    reader.readAsDataURL(file.raw);
    reader.onload = () => {
      let bstr = window.atob(reader.result.split(',')[1]); // 获得base64解码后的字符串
      let n = bstr.length;
      let ab = new ArrayBuffer(n);
      let u8arr = new Uint8Array(ab); // 新建一个8位的整数类型数组，用来存放ASCII编码的字符串
      while (n--) {
          u8arr[n] = bstr.charCodeAt(n) // 转换编码后才使用charCodeAt 找到Unicode编码 
      }
      const fileStream = new Blob([ab], { type: `video/${file.name.split('.')[1]}` });
      console.log(fileStream);
      let url = window.URL.createObjectURL(fileStream) // blob url
      this.setState({orgVideoURL: url});
      // console.log(this.state.orgVideoURL);
      //
      let dataURL = reader.result;
      let urlParts = dataURL.split(',');
      this.setState({urlHead: urlParts[0]});
      let dataBase64 = urlParts[1];
      reader.readAsArrayBuffer(file.raw);
      reader.onload = () => {
        // let wordArray = Crypto.lib.WordArray.create(reader.result);
        xhr.send(JSON.stringify({
          task_id: this.getId(), // only Nnumber allowed?
          file_type: 'video',
          file_name: file.name,
          file_data: dataBase64,
        }));
      }
    }
  }

  analyzing() {
    // 后台开始解析视频，同步解析进度
    this.setState({
      title: '后台解析中',
      waiting: true,
      pg1Visible: false,
      pg2Visible: true,
      uploadProgress: 0,
    });
    // 轮询后台解析进度
    let lastPrg = 0.0;
    var timer = setInterval(() => {
      let xhr = new XMLHttpRequest();
      xhr.open('GET', this.state.resURL, true);
        xhr.onload = () => {
          let res = JSON.parse(xhr.response);
          console.log(res);
          if (Number(res.progression) < 1.0 && (res.progression >= lastPrg)) {
            this.setState({ analyseProgress: Number(parseInt(res.progression * 100))});
            lastPrg = res.progression;
            return;
          }
          let bstr = window.atob(res.file_data); // 获得base64解码后的字符串
          let n = bstr.length;
          let ab = new ArrayBuffer(n);
          let u8arr = new Uint8Array(ab); // 新建一个8位的整数类型数组，用来存放ASCII编码的字符串
          while (n--) {
              u8arr[n] = bstr.charCodeAt(n) // 转换编码后才使用charCodeAt 找到Unicode编码 
          }
          const fileStream = new Blob([ab], { type: 'video/mp4' });
          console.log(fileStream);
          let url = window.URL.createObjectURL(fileStream) // blob url
          // load video 
          this.setState({ resVideoURL: url });
          // console.log(this.state.resVideoURL);
          this.finish();
          clearInterval(timer);
          // prepare to download video
          let a = document.getElementById('download');
          a.href = url;
          a.download = 'motion_capture_' + res.file_name;
          console.log('---- Loop query finished');
        }
        xhr.send();
        console.log("---- Query sent")
    }, 3000);
  }

  MD5(wordArray) {
    let t1 = new Date().getTime();
    let hash = Crypto.SHA256(wordArray).toString();
    let t2 = new Date().getTime();
    console.log('Crypto-SHA256 time cost(ms): ' + (t2 - t1))
    console.log(hash);
    return hash;
  }

  finish() {
    // 展示预览视频, 并存入Aside bar 和 LocalStorage?
    this.setState({
      title: '完成',
      analyseProgress: 100,
      waiting: false,
    })
    setTimeout(() => {
      this.setState({
        pg2Visible: false,
        entryVisible: true,
        expand: true,
        analyseProgress: 0,
      })
    }, 500);
  }

  async requestMethod() {
    return {
      status: 'fail',
    };
  };

  downloadVideo() {
    let a = document.getElementById('download');
    a.click();
  }

  downloadActionFile() {
    this.invalidButton();
  }

  hideOriginVideo() {
    this.setState({hideOrigin: true})
  }

  computeOffset() {
    let videos = document.getElementsByTagName('video');
    let mid = window.innerWidth / 2;
    let left = (window.innerWidth - videos[0].clientWidth - videos[1].clientWidth - 64) / 2;
    this.setState({offsetX: (mid - left - videos[0].clientWidth / 2)});
  }

  getId() {
    this.setState({taskId: this.state.taskId + 1});
    return this.state.taskId;
  }

  fullScreen() {
    let usrAg = window.navigator.userAgent;
    if (!document.fullscreenElement && usrAg.includes('Chrome')) {
      document.getElementsByTagName('video')[0].requestFullscreen();
    }
    if (!document.webkitDisplayingFullscreen && usrAg.includes('Safari')) {
      document.getElementsByTagName('video')[0].webkitEnterFullscreen();
    }
  }

  closeDrawer() {
    this.setState({drawerVisible: false});
  }

  openDrawer() {
    this.setState({
      drawerVisible: true,
    });
  }

  render() {
    return (
      <Layout className='App'>
        <Header className='header'>
          <h1 className={`title ${this.state.waiting?'waiting':''}`}>{this.state.title}<LoadingIcon  className={`titleIcon ${this.state.waiting?'loading':''}`}/></h1>
          <div className='toolBar'>
            <Button className='openDrawer' variant='outline' onClick={this.openDrawer.bind(this)}><MenuFoldIcon /></Button>
            <span className="divider"></span>
          </div>
        </Header>
        <Drawer 
          header='历史记录'
          className='sideDrawer'
          visible={this.state.drawerVisible}
          onClose={this.closeDrawer.bind(this)} 
          showOverlay={false}
          footer={false}
          placement="left"
        >

        </Drawer>
        <Content className='content'>
          <div className={`gradient-top ${this.state.waiting?'bgChange':''}`}></div>
          <div className={`entry ${this.state.entryVisible?'active':''} ${this.state.expand?'fold':''}`}>
            <Button className='entryBtn' theme="primary" onClick={()=>{this.setState({dlgVisible: true})}} icon={<CloudUploadIcon />}>
              上传视频
            </Button>
            <p className="tip">视频时长小于30s</p>
            <div 
              id='uploadProgress'
              className={`progress ${this.state.pg1Visible?'active':''} ${this.state.waiting?'waiting':'done'}`}
            >
              <Progress  theme={'circle'} percentage={this.state.uploadProgress} size="large" strokeWidth={8}/>
            </div>
            <div 
              id='analyseProgress' 
              className={`progress ${this.state.pg2Visible?'active':''} ${this.state.waiting?'waiting':'done'}`}
            >
              <Progress theme={'circle'} percentage={this.state.analyseProgress} size="large" strokeWidth={8}/>
            </div>
          </div>
          <div className={`preview-window ${this.state.expand?'expand':''}`}>
            <div className='videoWrapper'>
              <div 
                className={`videoBox ${this.state.hideOrigin?'hide':''}`}
                style={{'transform': this.state.hideOrigin?`translateX(${this.state.offsetX}px)`:'none'}}
              >
                <Button className='fullScreen' variant='outline'  onClick={this.fullScreen.bind(this)}>
                  <FullscreenIcon />
                </Button>
                <video 
                  src={this.state.resVideoURL}
                  autoPlay
                  controls
                  playsInline
                  loop
                  muted
                  onCanPlay={this.computeOffset.bind(this)}
                  >
                </video>
                  <div className="optBar L">
                    <Button variant='outline' onClick={this.downloadVideo.bind(this)} className='optBtn'>
                      下载视频
                      <a id='download' href=''></a>
                    </Button>
                    <Button theme='primary' onClick={this.downloadActionFile.bind(this)} className='optBtn'>
                      下载动作文件(BIP+FBX)
                    </Button>
                  </div>
              </div>
              
              <div 
                className={`videoBox ${this.state.hideOrigin?'hide':''} ${this.state.hideOrigin?'opacity':''}`}
                style={{'transform': this.state.hideOrigin?`translateX(${this.state.offsetX}px)`:'none'}}
              >
                <video 
                  src={this.state.orgVideoURL}
                  autoPlay
                  controls
                  playsInline
                  loop
                  muted
                  ></video>
                  <div className="optBar R">
                    <Button theme='default' className='optBtn' onClick={this.hideOriginVideo.bind(this)}>隐藏原视频</Button>
                  </div>
              </div>
            </div>
          </div>
          <Dialog
              header="上传视频须知"
              visible={this.state.dlgVisible}
              width={this.state.dlgWidth}
              footer={
                <div className='dlgFooter'>
                  <Button variant="outline" onClick={()=>{this.setState({dlgVisible: false})}}>
                    取消
                  </Button>
                  <Upload
                    accept="video/mp4,video/mov"
                    requestMethod={this.requestMethod.bind(this)}
                    onChange={this.handleChange.bind(this)}
                    theme="custom"
                    beforeUpload={this.beforeUpload.bind(this)}
                    multiple={false}
                    showUploadProgress={false}
                  >
                    <Button theme="primary" className='uploadBtn' icon={<UploadIcon />}>选择视频</Button>
                  </Upload>
                </div>
              }
              onClose={()=>{this.setState({dlgVisible: false})}}
            >
              <h2>为了得到最好的小K动捕效果，请注意上传视频的要求：</h2>
              <img src={require('./static/img/guide.png')} className='guideImg' alt='guide'></img>
              <p>1. 单人全身清晰视频，四肢都在视频中，视频中人物不要太小;</p>
              <p>2. 视频中人物不要有物品遮挡身体，衣着简单，不要穿太宽松的上衣和过膝的裙子，以免遮挡身体;</p>
              <p>3如果是自己拍摄的视频，请注意:</p>
              <ul>
                <li>拍摄视频时手机尽量平行人体，不要倾斜拍摄;拍摄视频的场地选择光线明亮的地方</li>
                <li>注意拍摄角度，人物四肢都在视频中显露出来，减少遮挡情况;人物尽量不要穿全白或全黑的衣服</li>
              </ul>
              <p>4. 视频长度<span className='strong'>30秒</span>以内，大小<span className='strong'>25M</span>以内</p>
            </Dialog>
            <div className='gradient'></div>
        </Content>
        <div className={`mask ${this.state.expand?'reveal':''}`}>Copyright @ 2019-2021 Tencent. All Rights Reserved</div>
        <img 
          src={require('./static/img/arrow-left.png')}
          className={`arrow ${(this.state.hideOrigin && this.state.expand)?'showArrow':''}`} 
          onClick={()=>{this.setState({hideOrigin: false})}}
          alt='arrow-left'
        ></img>
      </Layout>
    )
  }
}

export default App;
