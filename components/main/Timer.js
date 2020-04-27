import React from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import TimePicker from 'react-native-24h-timepicker';
import SQLite from 'react-native-sqlite-2';
import BackgroundTimer from 'react-native-background-timer';

var PushNotification = require('react-native-push-notification');

var db = SQLite.openDatabase('time.db', '1.0', '', 1);

const maxIncrement = 15;

export default class Timer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      seconds: 0, // Time keeping
      timer: '',
      max_seconds: 0,
      going: true, // If timer running
      has_started: false, // If timer was started
      end: false, // If timer ended
      increments: 0, // Number of minutes added
      done: 0, // Successes
      fail: 0, // Failures
      a_progress: new Animated.Value(0), // For progress
      a_flash: new Animated.Value(0),
    };

    /* Initializes table to store time values */
    db.transaction(function(txn) {
      txn.executeSql(
        'CREATE TABLE IF NOT EXISTS time_keep(time_id INTEGER PRIMARY KEY NOT NULL, max_seconds INT(20))',
        [],
        function(tx, res) {
          if (res.rows.length == 0) {
            txn.executeSql(
              'INSERT INTO time_keep (time_id, max_seconds) VALUES (?,?)',
              [0, 60],
            );
          }
        },
      );

      txn.executeSql(
        'CREATE TABLE IF NOT EXISTS score_keep(score_id INTEGER PRIMARY KEY NOT NULL, done INT(20), fail INT(20))',
        [],
        function(tx, res) {
          if (res.rows.length == 0) {
            txn.executeSql(
              'INSERT INTO score_keep (score_id, done, fail) VALUES (?,?,?)',
              [0, 0, 0],
            );
          }
        },
      );
    });
  }

  componentDidMount() {
    this.refreshAll();
  }

  _interval: any;

  onStart = () => {
    this.setState({
      going: true,
      has_started: true,
    });

    this._interval = BackgroundTimer.setInterval(() => {
      if (this.state.seconds == 300) {
        PushNotification.localNotification({
          vibrate: true,
          vibration: 300,
          ignoreInForeground: false,
          id: 118,
          title: 'Break Time',
          message: '5 minutes until your next break!',
          playSound: true,
          soundName: 'default',
          number: 10,
        });
      }

      if (this.state.seconds == 0) {
        this.handleDone();
      } else {
        this.setState({
          seconds: this.state.seconds - 1,
        });
      }
      this.timerUpdate();
    }, 1000);

    this.a_progressStart();
  };

  onPause = () => {
    BackgroundTimer.clearInterval(this._interval);

    this.setState({
      going: false,
    });

    this.a_progressPause();
  };

  onAdd = min => {
    let newRatio = -1;
    if (this.state.going) {
      let elapsed = this.state.max_seconds - this.state.seconds;
      let newMax = this.state.max_seconds + min * 60;
      newRatio = (elapsed * 100) / newMax;
    }

    this.setState(
      {
        seconds: this.state.seconds + min * 60,
        max_seconds: this.state.max_seconds + min * 60,
      },
      this.timerUpdate,
    );

    if (this.state.has_started) {
      this.setState({
        increments: this.state.increments + min,
      });
    } else {
      db.transaction(txn => {
        txn.executeSql('UPDATE time_keep SET max_seconds=? WHERE time_id=0', [
          this.state.max_seconds,
        ]);
      });
    }

    this.a_progressSet(newRatio);
    this.a_progressStart;
  };

  onFail = () => {
    db.transaction(txn => {
      txn.executeSql('UPDATE score_keep SET fail=? WHERE score_id=0', [
        this.state.fail,
      ]);
    });

    this.setState({
      fail: this.state.fail + 1,
      end: false,
    });

    this.onRemake();
  };

  onDone = () => {
    db.transaction(txn => {
      txn.executeSql(
        'UPDATE score_keep SET done=? WHERE score_id=0',
        [this.state.done],
        (tx, res) => {
          console.log(res.rows);
        },
      );
    });

    this.setState({
      done: this.state.done + 1,
      end: false,
    });

    this.onRemake();
  };

  onRemake = () => {
    this.refreshAll();
    this.a_progressReset();
  };

  onScoreTouch = () => {
    if (this.state.done == this.state.fail && this.state.done == 0) return;

    Alert.alert(
      'Are you sure?',
      'This will erase all records of your successes and failures.',
      [
        {
          text: 'Yes',
          onPress: this.restoreScore,
        },
        {
          text: 'No',
        },
      ],
      {cancelable: false},
    );
    return;
  };

  db_timer = () => {
    db.transaction(txn => {
      txn.executeSql('SELECT * FROM time_keep', [], (tx, results) => {
        this.setState({
          seconds: results.rows.item(0).max_seconds,
          max_seconds: results.rows.item(0).max_seconds,
        });
        this.timerUpdate();
      });
    });
  };

  db_score = () => {
    db.transaction(txn => {
      txn.executeSql('SELECT * FROM score_keep', [], (tx, results) => {
        this.setState({
          done: results.rows.item(0).done,
          fail: results.rows.item(0).fail,
        });
      });
    });
  };

  refreshAll = () => {
    this.db_timer();
    this.db_score();

    this.setState({
      has_started: false,
      increments: 0,
      end: false,
    });

    this.onPause();
  };

  restoreScore = () => {
    db.transaction(txn => {
      txn.executeSql(
        'UPDATE score_keep SET done=?, fail=? WHERE score_id=0',
        [0, 0],
        (tx, res) => {
          console.log(res.rows);
        },
      );
    });

    this.setState({
      done: 0,
      fail: 0,
    });
  };

  timerUpdate = () => {
    let count = this.state.seconds;
    let hr = Math.floor(count / 3600);
    count = count - hr * 3600;
    let min = Math.floor(count / 60);
    count = count - min * 60;
    let sec = count;

    hr = hr < 10 ? '0' + hr : hr;
    min = min < 10 ? '0' + min : min;
    sec = sec < 10 ? '0' + sec : sec;

    this.setState({
      timer: '' + hr + ':' + min + ':' + sec,
    });
  };

  handleDone = () => {
    PushNotification.localNotification({
      vibrate: true,
      vibration: 300,
      ignoreInForeground: false,
      id: 117,
      title: 'Break Time',
      message: 'Time for a break!',
      playSound: true,
      soundName: 'default',
      number: 10,
    });

    this.setState({
      end: true,
    });
    this.a_progressSet(100);
    this.onPause();
  };

  selectTime = () => {
    if (this.state.going || this.state.has_started) {
      Alert.alert(
        'Are you sure?',
        'Changing interval will reset the current countdown.',
        [
          {
            text: 'Yes',
            onPress: () => {
              this.onPause();
              this.TimePicker.open();
            },
          },
          {
            text: 'No',
          },
        ],
        {cancelable: false},
      );
    } else this.TimePicker.open();
  };

  onCancel() {
    this.TimePicker.close();
  }

  onConfirm(hour, minute) {
    let actualTime = 3600 * `${hour}` + 60 * `${minute}`;
    if (actualTime == 0) {
      Alert.alert(
        'Invalid Interval Selected',
        'Please select a valid interval!',
        [
          {
            text: 'Ok',
          },
        ],
        {cancelable: false},
      );
      return;
    }

    db.transaction(txn => {
      txn.executeSql('UPDATE time_keep SET max_seconds=? WHERE time_id=0', [
        actualTime,
      ]);
    });

    this.refreshAll();
    this.a_progressReset();
    this.TimePicker.close();
  }

  _renderButton = () => {
    if (this.state.end) {
      return (
        <>
          <TouchableOpacity activeOpacity={1} onPress={this.onDone}>
            <Image
              source={require('../../media/check.png')}
              style={styles.buttons}
            />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={1} onPress={this.onFail}>
            <Image
              source={require('../../media/cross.png')}
              style={styles.buttons}
            />
          </TouchableOpacity>
        </>
      );
    } else if (!this.state.going) {
      return (
        <TouchableOpacity activeOpacity={1} onPress={this.onStart}>
          <Image
            source={require('../../media/play.png')}
            style={styles.buttons}
          />
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity activeOpacity={1} onPress={this.onPause}>
          <Image
            source={require('../../media/pause.png')}
            style={styles.buttons}
          />
        </TouchableOpacity>
      );
    }
  };

  _renderIncrement = val => {
    if (this.state.increments + val <= maxIncrement && !this.state.end) {
      return (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            this.onAdd(val);
          }}>
          <Text style={styles.buttonText}> +{val} </Text>
        </TouchableOpacity>
      );
    } else {
      return <Text style={styles.lockedText}> +{val} </Text>;
    }
  };

  a_progressStart = () => {
    Animated.timing(this.state.a_progress, {
      toValue: 100,
      easing: Easing.linear,
      duration: this.state.seconds * 1000,
    }).start();
  };

  a_progressSet = val => {
    if (val > 100 || val < 0) return;
    this.setState({
      a_progress: new Animated.Value(val),
    });
  };

  a_progressPause = () => {
    Animated.timing(this.state.a_progress).stop();
  };

  a_progressReset = () => {
    Animated.timing(this.state.a_progress, {
      toValue: 0,
      duration: 1000,
      easing: Easing.ease,
    }).start();
  };

  render() {
    return (
      <View style={styles.mainContainer}>
        <View style={styles.scoreContainer}>
          <TouchableOpacity activeOpacity={1} onPress={this.onScoreTouch}>
            <Text style={styles.scoreText}>
              {this.state.done} | {this.state.fail}
            </Text>
            <Text style={styles.scoreHeader}>O | X</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timerContainer}>
          <TouchableOpacity activeOpacity={1} onPress={this.selectTime}>
            <Text style={styles.timerText}>{this.state.timer}</Text>
          </TouchableOpacity>
          <View style={styles.incrementContainer}>
            {this._renderIncrement(5)}
            {this._renderIncrement(10)}
          </View>
        </View>

        <View style={styles.buttonContainer}>{this._renderButton()}</View>

        <Animated.View
          style={{
            ...styles.progressStyle,
            height: this.state.a_progress.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />

        <TimePicker
          ref={ref => {
            this.TimePicker = ref;
          }}
          onCancel={() => this.onCancel()}
          onConfirm={(hour, minute) => this.onConfirm(hour, minute)}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  mainContainer: {
    backgroundColor: '#ffab19',
    height: '100%',
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressStyle: {
    backgroundColor: 'gray',
    width: '100%',
    position: 'absolute',
    zIndex: -2,
  },
  scoreContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '20%',
  },
  scoreHeader: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scoreText: {
    textAlign: 'center',
    fontSize: 60,
    fontWeight: 'bold',
    color: '#FFF',
  },
  timerContainer: {
    height: '60%',
    justifyContent: 'center',
  },
  timerText: {
    textAlign: 'center',
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
  },
  incrementContainer: {
    height: 55,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  lockedText: {
    textAlign: 'center',
    fontSize: 50,
    color: '#AAA',
    fontWeight: 'bold',
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 50,
    color: '#FFF',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    height: '20%',
  },
  buttons: {
    height: 60,
    width: 60,
    tintColor: '#FFF',
  },
  countContainer: {
    alignItems: 'center',
    padding: 10,
  },
});
