import React from 'react'
import Authentication from '../../util/Authentication/Authentication'
import $ from 'jquery';

import './App.css'

var token;// = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2NTU2ODY0MjAsIm9wYXF1ZV91c2VyX2lkIjoiVTQ4NTY2Mzc1Iiwicm9sZSI6ImJyb2FkY2FzdGVyIiwicHVic3ViX3Blcm1zIjp7Imxpc3RlbiI6WyJicm9hZGNhc3QiLCJnbG9iYWwiXSwic2VuZCI6WyJicm9hZGNhc3QiXX0sImNoYW5uZWxfaWQiOiI0ODU2NjM3NSIsInVzZXJfaWQiOiI0ODU2NjM3NSIsImlhdCI6MTY1NTYwMDAyMH0.IUwW69pEHeuT0MRrpnZJJXyWb1vU30jEXq1DTHjoT4A";

export default class App extends React.Component{
    constructor(props){
        super(props)
        this.Authentication = new Authentication()

        //if the extension is running on twitch or dev rig, set the shorthand here. otherwise, set to null. 
        this.twitch = window.Twitch ? window.Twitch.ext : null
        this.state={
            finishedLoading:false,
            theme:'light',
            isVisible:true,
            currentRound: 0,
            lastRound: 0,
            cooldown: false
        }
        
        //document.addEventListener('click',this.clickEffect);
    }

    // create the request options for our Twitch API calls
    requests = {
      round: this.createRequest('GET', 'round'),
      vote: this.createRequest('POST', 'vote', ""),
    };
    bufferTime = 3;

    createRequest (type, method, data) {
      return {
        type: type,
        url: 'https://blurbsttv.com/' + method,
        //url: 'https://localhost:8081/' + method,
        crossDomain: true,
        data: data != null ? {"vote":`${data}`} : null,
        //dataType: 'json',
        success: this.logSuccess,
        error: this.logError
      };
    }
    setAuth () {
      Object.keys(this.requests).forEach((req) => {
        console.log('Setting auth headers');
        this.requests[req].headers = { 'Authorization': 'Bearer ' + this.Authentication.state.token };
        console.log(this.requests[req].headers);
      });
    }
    
    logError(_, error, status) {
      console.log('EBS request returned '+status+' ('+error+')');
      console.log(error);
    }
    logSuccess(hex, status) {
        console.log('EBS request returned '+hex+' ('+status+')');
    }

    contextUpdate(context, delta){
        if(delta.includes('theme')){
            this.setState(()=>{
                return {theme:context.theme}
            })
        }
    }

    visibilityChanged(isVisible){
        this.setState(()=>{
            return {
                isVisible
            }
        })
    }

    newRound(roundNum) {
      $(".marker").remove();
      this.setState({currentRound: roundNum});
    }

    componentDidMount(){
        if(this.twitch){
            this.twitch.onAuthorized((auth)=>{
                this.token = auth.token;
                console.log("TOKEN : " + auth.token);
                this.Authentication.setToken(auth.token, auth.userId);
                if(!this.state.finishedLoading){
                    // if the component hasn't finished loading (as in we've not set up after getting a token), let's set it up now.

                    // now we've done the setup for the component, let's set the state to true to force a rerender with the correct data.
                    this.setState(()=>{
                        return {finishedLoading:true}
                    })
                }
            })
            console.log("PUB SUB LISTEN");
            this.twitch.listen('broadcast',(target,contentType,body)=>{
                console.log(`New PubSub message!\n${target}\n${contentType}\n${body}`);
                // now that you've got a listener, do something with the result... 
                // do something...
                if (body.indexOf("newRound") > -1) {
                  setTimeout(() => {this.newRound(parseInt(body.replace('newRound', '')));}, this.bufferTime * 1000);
                }
                if (body.indexOf("statusUpdate") > -1) {
                  $('.percent').text('');
                  let percentages = body.replace('statusUpdate', '').split('%').filter(x => x).map(x => {
                    let num = parseFloat(x.slice(2, x.length - 2));
                    return {cell: x.slice(0,2), percent: num};
                  });
                  percentages.sort((a, b) => {return b.percent - a.percent});
                  for(let i = 0;i < percentages.length; i++) {
                    let el = percentages[i];
                    $(`#${el.cell}`).children().first().text((i+1).toString());
                  }
                }
            })

            this.twitch.onVisibilityChanged((isVisible,_c)=>{
                this.visibilityChanged(isVisible)
            })

            this.twitch.onContext((context,delta)=>{
                this.contextUpdate(context,delta)
            })
        }
    }

    componentWillUnmount(){
        if(this.twitch){
            this.twitch.unlisten('broadcast', ()=>console.log('successfully unlistened'))
        }
    }

    onMoveForwardHandler = () => {
        this.setAuth();
        console.log("CLICK");
        $.ajax(this.requests.forward);
    }

    onMoveBackHandler = () => {
        this.setAuth();
        console.log("CLICK");
        $.ajax(this.requests.back);
    }

    onLookLeftHandler = () => {
        this.setAuth();
        console.log("CLICK");
        $.ajax(this.requests.lookLeft);
    }

    onLookRightHandler = () => {
        this.setAuth();
        console.log("CLICK");
        $.ajax(this.requests.lookRight);
    }

    onClickItemHandler = () => {
        this.setAuth();
        console.log("CLICK");
        $.ajax(this.requests.clickItem);
    }

    onGridClick = (cell) => {
        //this.setState({cooldown: true});
        //setTimeout(() => {this.setState({cooldown: false});}, 500);
        this.setAuth();
        console.log("CELL CLICKED: " + cell);
        //let roundRequest = this.requests.round;
        let voteRequest = this.requests.vote;

        console.log("CURRENTROUND: " + this.state.currentRound.toString() + " LASTROUND: " + this.state.lastRound);
        //if (this.state.currentRound != this.state.lastRound) {
          voteRequest.data = {
            "vote":`${cell}`,
            "round": this.state.currentRound
          };
          this.setState({lastRound: this.state.currentRound});
          $.ajax(voteRequest);
        //}
        //else
        //  console.log("VOTE FAILED");
        
        
        /*$.ajax(roundRequest).then(x => {
          currentRound = x;
          voteRequest.data = {
            "vote":`${cell}`,
            "round": currentRound
          };
          console.log("CURRENTROUND: " + currentRound.toString() + " LASTROUND: " + this.state.lastRound);
          if (currentRound != this.state.lastRound) {
            this.setState({lastRound: currentRound});
            $.ajax(voteRequest);
          }
          else
          console.log("FAIL");
        });*/
    }

    clickEffect = (e) => {
      if (this.state.cooldown || this.state.currentRound == this.state.lastRound)
        return;
      var d = document.createElement("div");
      d.className = "clickEffect";
      d.style.top = e.clientY+"px";
      d.style.left = e.clientX+"px";
      document.body.appendChild(d);
      d.addEventListener('animationend',function(){d.parentElement.removeChild(d);}.bind(this));

      $(".marker").remove();
      var marker = document.createElement("div");
      marker.className = "marker";
      marker.style.top = e.clientY+"px";
      marker.style.left = e.clientX+"px";
      document.body.appendChild(marker);
    }
    
    render(){
        if(this.state.finishedLoading && this.state.isVisible){
            return (
                <div className="App">
                  <div className="full-size">
                    <div className="aspect-ratio-box-inside">
                      <div className="flexbox-centering" onClick={this.clickEffect}>
                        <div className="viewport-sizing">
                          <button id="A1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A1") }}><span className="percent"></span></button>
                          <button id="A2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A2") }}><span className="percent"></span></button>
                          <button id="A3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A3") }}><span className="percent"></span></button>
                          <button id="A4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A4") }}><span className="percent"></span></button>
                          <button id="A5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A5") }}><span className="percent"></span></button>
                          <button id="A6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A6") }}><span className="percent"></span></button>
                          <button id="B1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B1") }}><span className="percent"></span></button>
                          <button id="B2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B2") }}><span className="percent"></span></button>
                          <button id="B3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B3") }}><span className="percent"></span></button>
                          <button id="B4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B4") }}><span className="percent"></span></button>
                          <button id="B5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B5") }}><span className="percent"></span></button>
                          <button id="B6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B6") }}><span className="percent"></span></button>
                          <button id="C1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C1") }}><span className="percent"></span></button>
                          <button id="C2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C2") }}><span className="percent"></span></button>
                          <button id="C3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C3") }}><span className="percent"></span></button>
                          <button id="C4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C4") }}><span className="percent"></span></button>
                          <button id="C5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C5") }}><span className="percent"></span></button>
                          <button id="C6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C6") }}><span className="percent"></span></button>
                          <button id="D1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D1") }}><span className="percent"></span></button>
                          <button id="D2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D2") }}><span className="percent"></span></button>
                          <button id="D3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D3") }}><span className="percent"></span></button>
                          <button id="D4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D4") }}><span className="percent"></span></button>
                          <button id="D5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D5") }}><span className="percent"></span></button>
                          <button id="D6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D6") }}><span className="percent"></span></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )
        }else{
            return (
                <div className="App">
                  <p>Move Forward <input value='Vote' type='button' onClick={this.onMoveForwardHandler}/></p>
                  <p>Move Back <input value='Vote' type='button' onClick={this.onMoveBackHandler}/></p>
                  <p>Look Left <input value='Vote' type='button' onClick={this.onLookLeftHandler}/></p>
                  <p>Look Right <input value='Vote' type='button' onClick={this.onLookRightHandler}/></p>
                  <p>Click Item <input value='Vote' type='button' onClick={this.onClickItemHandler}/></p>
                  <div className="aspect-ratio-box">
                    <div className="aspect-ratio-box-inside">
                      <div className="flexbox-centering" onClick={this.clickEffect}>
                        <div className="viewport-sizing">
                          <button id="A1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A1") }}><span className="percent"></span></button>
                          <button id="A2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A2") }}><span className="percent"></span></button>
                          <button id="A3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A3") }}><span className="percent"></span></button>
                          <button id="A4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A4") }}><span className="percent"></span></button>
                          <button id="A5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A5") }}><span className="percent"></span></button>
                          <button id="A6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("A6") }}><span className="percent"></span></button>
                          <button id="B1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B1") }}><span className="percent"></span></button>
                          <button id="B2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B2") }}><span className="percent"></span></button>
                          <button id="B3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B3") }}><span className="percent"></span></button>
                          <button id="B4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B4") }}><span className="percent"></span></button>
                          <button id="B5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B5") }}><span className="percent"></span></button>
                          <button id="B6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("B6") }}><span className="percent"></span></button>
                          <button id="C1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C1") }}><span className="percent"></span></button>
                          <button id="C2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C2") }}><span className="percent"></span></button>
                          <button id="C3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C3") }}><span className="percent"></span></button>
                          <button id="C4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C4") }}><span className="percent"></span></button>
                          <button id="C5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C5") }}><span className="percent"></span></button>
                          <button id="C6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("C6") }}><span className="percent"></span></button>
                          <button id="D1" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D1") }}><span className="percent"></span></button>
                          <button id="D2" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D2") }}><span className="percent"></span></button>
                          <button id="D3" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D3") }}><span className="percent"></span></button>
                          <button id="D4" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D4") }}><span className="percent"></span></button>
                          <button id="D5" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D5") }}><span className="percent"></span></button>
                          <button id="D6" className="gridBtn" disabled={this.state.cooldown} onClick={() => { this.onGridClick("D6") }}><span className="percent"></span></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )
        }

    }
}

/*
let token = '';
let tuid = '';

const twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
const requests = {
  set: createRequest('POST', 'cycle'),
  get: createRequest('GET', 'query')
};

function createRequest (type, method) {
  return {
    type: type,
    //url: location.protocol + '//localhost:8081/color/' + method,
    url: 'https://localhost:8081/color/' + method,
    success: updateBlock,
    error: logError
  };
}

function setAuth (token) {
  Object.keys(requests).forEach((req) => {
    twitch.rig.log('Setting auth headers');
    requests[req].headers = { 'Authorization': 'Bearer ' + token };
  });
}

twitch.onContext(function (context) {
  twitch.rig.log(context);
});

twitch.onAuthorized(function (auth) {
  // save our credentials
  token = auth.token;
  tuid = auth.userId;

  // enable the button
  $('#cycle').removeAttr('disabled');

  setAuth(token);
  twitch.rig.log(requests.get.url);
  $.ajax(requests.get);
  twitch.rig.log("DONE");
});

function updateBlock (hex) {
  twitch.rig.log('Updating block color');
  $('#color').css('background-color', hex);
}

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
  twitch.rig.log(error);
}

function logSuccess(hex, status) {
  twitch.rig.log('EBS request returned '+hex+' ('+status+')');
}

$(function () {
  // when we click the cycle button
  $('#cycle').click(function () {
  if(!token) { return twitch.rig.log('Not authorized'); }
    twitch.rig.log('Requesting a color cycle');
    twitch.rig.log(requests.set.url);
    $.ajax(requests.set);
    twitch.rig.log("DONE");
  });
});
*/