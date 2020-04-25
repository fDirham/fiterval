import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated
} from 'react-native';
import PropTypes from 'prop-types';
import TimePicker from "react-native-24h-timepicker";
import SQLite from "react-native-sqlite-2";
import BackgroundTimer from "react-native-background-timer";

var PushNotification = require('react-native-push-notification')

var db = SQLite.openDatabase("time.db", "1.0", "", 1);

export default class Timer extends React.Component{
    constructor(props){
        super(props)
        this.state={
            going: false,
            seconds: 0,
            timer: "",
            max_seconds: 1,
            scale_factor: new Animated.Value(1),
            opacity_factor: new Animated.Value(1),
            done: false
        }


        /* Initializes table to store time values */
        db.transaction(function(txn) {
            txn.executeSql(
            'CREATE TABLE IF NOT EXISTS time_keep(time_id INTEGER PRIMARY KEY NOT NULL, max_seconds INT(20))',
            [],
            function(tx, res) {
                if(res.rows.length == 0){
                    txn.executeSql('INSERT INTO time_keep (time_id, max_seconds) VALUES (?,?)', [0, 60])
                }
            }
            );
        });
    }



    componentDidMount(){
        this.onReset();
    }

    _interval: any;
    onStart = () => {
        // Prevents double clicking start and messing up timer
        if (this.state.seconds == 0) {
            this.handleDone();
            return;
        }

        this.setState({
            going: true
        });

        this.animStart();
        this._interval = BackgroundTimer.setInterval(() => {
            if (this.state.seconds == 300) {
                PushNotification.localNotification({
                    vibrate: true,
                    vibration: 300,
                    ignoreInForeground: false,
                    id: 118,
                    title: "Fiterval",
                    message: "5 minutes until your next break!",
                    playSound: true,
                    soundName: "default",
                    number: 10,
                    });
            }

            if (this.state.seconds == 0){
                this.handleDone();
            }
            else{
                this.setState({
                    seconds: this.state.seconds - 1,
                })
            }
            this.timerUpdate();
        }, 1000)
    }

    onPause = () => {
        this.setState({
            going: false
        })
        BackgroundTimer.clearInterval(this._interval);
        this.animPause();
    }

    onReset = () => {
        if(this.state.done){
            this.setState({
                done: false
            })
        }

        db.transaction((txn)=> {
            txn.executeSql(
                'SELECT * FROM time_keep',
                [],
                (tx, results) => {
                    this.setState({
                        seconds: results.rows.item(0).max_seconds,
                        max_seconds: results.rows.item(0).max_seconds,
                    });
                    this.timerUpdate();
            });
        });
        this.onPause();
        this.animReset();
    }

    timerUpdate = () => {
        let count = this.state.seconds;
        let hr = Math.floor(count/3600);
        count = count - hr*3600;
        let min = Math.floor(count/60);
        count = count - min*60;
        let sec = count;

        hr = (hr < 10) ? "0" + hr : hr;
        min = (min < 10) ? "0" + min : min;
        sec = (sec < 10) ? "0" + sec : sec;
        this.setState({
            timer: "" + hr + ":" + min + ":" + sec
        })

    }

    handleDone = () => {

        PushNotification.localNotification({
            vibrate: true,
            vibration: 300,
            ignoreInForeground: false,
            id: 117,
            title: "Fiterval",
            message: "Time for a break!",
            playSound: true,
            soundName: "default",
            number: 10,
        });

        this.setState({
            done: true
        });
        this.onPause();
    }

    selectTime = () => {
        if(this.state.going == true){
            Alert.alert(
            'Are you sure?',
            'Pause the timer to make changes to interval.',
                [
                    {
                        text: 'Ok',
                    },
                ],
                {cancelable: false},
            );
        }
        else this.TimePicker.open();
    }

    onCancel() {
      this.TimePicker.close();
    }

    onConfirm(hour, minute) {
        let actualTime =  (3600 * `${hour}`) + (60 * `${minute}`);

        db.transaction((txn) => {
            txn.executeSql(
                'UPDATE time_keep SET max_seconds=? WHERE time_id=0',
                [actualTime]
            );
        });

        this.onReset();
        this.TimePicker.close();
    }

    animStart = () => {
        Animated.timing(this.state.scale_factor, {
            toValue: 0.7,
            duration: this.state.seconds * 1000
        }).start()

        Animated.timing(this.state.opacity_factor, {
            toValue: 0.1,
            duration: this.state.seconds * 1000
        }).start()
    }

    animPause = () => {
        Animated.timing(this.state.scale_factor).stop()

        Animated.timing(this.state.opacity_factor).stop()
    }

    animReset = () => {
        Animated.timing(this.state.opacity_factor, {
            toValue: 1,
            duration: 1000
        }).start()
        Animated.timing(this.state.scale_factor, {
            toValue: 1,
            duration: 1000
        }).start()
    }

    _renderPausePlay = () => {
        if(this.state.going){
            return(
                <TouchableOpacity onPress= {this.onPause}>
                    <Image source={require('../../media/pause.png')} style={styles.buttons}/>
                </TouchableOpacity>
            )
        }

        else if(this.state.done == false){
            return(
                    <TouchableOpacity onPress= {this.onStart}>
                        <Image source={require('../../media/play.png')} style={styles.buttons}/>
                    </TouchableOpacity>
            )
        }
    }

    render(){
        return(
            <View style={styles.mainContainer}>
                    <View style = {
                        styles.progressContainer
                        }>
                        <Animated.View
                            style={{
                                ...styles.progressBar,
                                opacity: this.state.opacity_factor,
                                transform: [{scale: this.state.scale_factor}, {rotate: "-135 deg"}]
                            }}
                        >
                            <View style = {styles.middleLogo}>
                            </View>
                        </Animated.View>
                    </View>

                <View style={styles.textContainer}>
                    <TouchableOpacity onPress={this.selectTime}>
                        <Text style={styles.timerText}>{this.state.timer}</Text>
                    </TouchableOpacity>

                <View style={styles.buttonContainer}>
                        {this._renderPausePlay()}
                        <TouchableOpacity onPress= {this.onReset}>
                            <Image source={require('../../media/restart.png')} style={styles.buttons}/>
                        </TouchableOpacity>
                    </View>
                </View>

                <TimePicker
                    ref={ref => {
                        this.TimePicker = ref;
                    }}
                    onCancel={() => this.onCancel()}
                    onConfirm={(hour, minute) => this.onConfirm(hour, minute)}
                />
            </View>
        )
    }
}

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: "#3b4145",
    height: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",

  },
  progressContainer:{
    height: 300,
    width: 300,
  },
  middleLogo:{
    height: 120,
    width: 120,
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    borderBottomLeftRadius: 180,
    backgroundColor: "#FFF",
    alignSelf: "center",
    marginTop: 65,
  },
  progressBar:{
    backgroundColor: "#ffa333",
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    borderBottomLeftRadius: 180,
    borderRadius: 0,
    height: 250,
    width: 250,
    alignSelf: "center",
  },
  timerText: {
    backgroundColor: "gray",
    textAlign: "center",
    fontSize: 40,
    fontWeight: "bold",
    paddingTop: 5,
    paddingBottom: 5,
    paddingRight: 15,
    paddingLeft: 15,
    borderTopRightRadius: 25,
    borderTopLeftRadius: 25,
    color: "#FFF",
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    width: 220,

  },
  buttons: {
    height: 60,
    width: 60,
    tintColor: "#FFF",
  },
  countContainer: {
    alignItems: "center",
    padding: 10
  }
});
