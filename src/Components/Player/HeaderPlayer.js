/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import classNames from 'classnames';
import { compose } from 'recompose';
import { withTranslation } from 'react-i18next';
import { withStyles } from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import SkipNextIcon from '@material-ui/icons/SkipNext';
import SkipPreviousIcon from '@material-ui/icons/SkipPrevious';
import CloseIcon from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import { borderStyle } from '../Theme';
import { getSrc } from '../../Utils/File';
import { getVideoDurationString } from '../../Utils/Common';
import { getDate, getDateHint, getTitle } from '../../Utils/Message';
import {
    PLAYER_PLAYBACKRATE_FAST,
    PLAYER_PLAYBACKRATE_NORMAL,
    PLAYER_STARTTIME,
    PLAYER_VOLUME_NORMAL
} from '../../Constants';
import PlayerStore from '../../Stores/PlayerStore';
import FileStore from '../../Stores/FileStore';
import TdLibController from '../../Controllers/TdLibController';
import './HeaderPlayer.css';

const styles = theme => ({
    iconButton: {
        padding: 8
    },
    ...borderStyle(theme)
});

class HeaderPlayer extends React.Component {
    constructor(props) {
        super(props);

        this.videoRef = React.createRef();

        const { playbackRate, message } = PlayerStore;

        this.startVolume = PLAYER_VOLUME_NORMAL;
        this.startTime = PLAYER_STARTTIME;

        console.log('clientUpdateMediaPlaybackRate ctor', playbackRate, PlayerStore);

        this.state = {
            playbackRate: playbackRate,
            message: message,
            playing: false,
            src: this.getMediaSrc(message)
        };
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        const { theme } = this.props;
        const { message, src, playing, currentTime, playbackRate } = this.state;

        if (nextProps.theme !== theme) {
            return true;
        }

        if (nextState.playbackRate !== playbackRate) {
            return true;
        }

        if (nextState.message !== message) {
            return true;
        }

        if (nextState.src !== src) {
            return true;
        }

        if (nextState.playing !== playing) {
            return true;
        }

        if (nextState.currentTime !== currentTime) {
            return true;
        }

        return false;
    }

    componentDidMount() {
        FileStore.on('clientUpdateVideoNoteBlob', this.onClientUpdateVideoNoteBlob);
        PlayerStore.on('clientUpdateMediaActive', this.onClientUpdateMediaActive);
    }

    componentWillUnmount() {
        FileStore.removeListener('clientUpdateVideoNoteBlob', this.onClientUpdateVideoNoteBlob);
        PlayerStore.removeListener('clientUpdateMediaActive', this.onClientUpdateMediaActive);
    }

    onClientUpdateVideoNoteBlob = update => {
        const { chatId, messageId } = update;
        const { message, playbackRate } = this.state;

        if (!message) return;

        const { chat_id, id, content } = message;
        if (!content) return;
        if (chatId !== chat_id || messageId !== id) return;

        switch (content['@type']) {
            case 'messageVideoNote': {
                const { video_note } = content;
                if (video_note) {
                    const { video } = video_note;
                    if (video) {
                        this.setState(
                            {
                                src: this.getMediaSrc(message)
                            },
                            () => {
                                const player = this.videoRef.current;
                                if (player) {
                                    //player.volume = this.startVolume;
                                    //player.playbackRate = playbackRate;
                                    player.currentTime = this.startTime;
                                    //player.play();
                                }
                            }
                        );
                    }
                }

                break;
            }
        }
    };

    onClientUpdateMediaActive = update => {
        const { chatId, messageId } = update;
        const { message, src, playbackRate } = this.state;

        if (message && message.chat_id === chatId && message.id === messageId) {
            if (src) {
                const player = this.videoRef.current;
                if (player) {
                    if (player.paused) {
                        player.play();
                    } else {
                        player.pause();
                    }
                }
            }
        } else {
            this.setState(
                {
                    message: PlayerStore.message,
                    src: this.getMediaSrc(PlayerStore.message)
                },
                () => {
                    const player = this.videoRef.current;
                    if (player) {
                        //player.volume = this.startVolume;
                        //player.playbackRate = playbackRate;
                        player.currentTime = this.startTime;
                        //player.play();
                    }
                }
            );
        }
    };

    handlePrev = () => {
        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaPrev'
        });
    };

    handlePlay = () => {
        const { message } = this.state;
        if (!message) return;

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaActive',
            chatId: message.chat_id,
            messageId: message.id
        });
    };

    handleNext = () => {
        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaNext'
        });
    };

    getMediaSrc = message => {
        if (message) {
            const { content } = message;
            if (content) {
                const { video_note } = content;
                if (video_note) {
                    const { video } = video_note;
                    if (video) {
                        return getSrc(video);
                    }
                }
            }
        }

        return null;
    };

    handleEnded = () => {
        const { message } = this.state;
        if (!message) return;

        this.setState({
            playing: false,
            message: null,
            src: null
        });

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaEnd',
            chatId: message.chat_id,
            messageId: message.id
        });
    };

    handleClose = () => {
        const player = this.videoRef.current;
        if (player) {
            player.pause();
        }

        this.handleEnded();
    };

    handleTimeUpdate = () => {
        const { message } = this.state;
        if (!message) return;

        const player = this.videoRef.current;
        if (!player) return;

        this.setState({ currentTime: player.currentTime });

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaTimeUpdate',
            chatId: message.chat_id,
            messageId: message.id,
            duration: player.duration,
            currentTime: player.currentTime,
            timestamp: Date.now()
        });
    };

    handleCanPlay = () => {
        const { message, playbackRate } = this.state;
        if (!message) return;

        const player = this.videoRef.current;
        if (!player) return;

        console.log('clientUpdateMediaPlaybackRate handleCanPlay', playbackRate);
        player.playbackRate = playbackRate;
        player.volume = this.startVolume;

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaCaptureStream',
            chatId: message.chat_id,
            messageId: message.id,
            stream: player.captureStream()
        });
    };

    handleVideoPlay = () => {
        const { message } = this.state;
        if (!message) return;

        this.setState({
            playing: true
        });

        const player = this.videoRef.current;
        if (!player) return;

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaPlay',
            chatId: message.chat_id,
            messageId: message.id,
            currentTime: player.currentTime,
            duration: player.duration,
            timestamp: Date.now()
        });
    };

    handleVideoPause = () => {
        const { message } = this.state;
        if (!message) return;

        this.setState({
            playing: false
        });

        const player = this.videoRef.current;
        if (!player) return;

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaPause',
            chatId: message.chat_id,
            messageId: message.id
        });
    };

    handlePlaybackRate = () => {
        const { playbackRate } = this.state;

        const nextPlaybackRate =
            playbackRate === PLAYER_PLAYBACKRATE_NORMAL ? PLAYER_PLAYBACKRATE_FAST : PLAYER_PLAYBACKRATE_NORMAL;

        this.setState(
            {
                playbackRate: nextPlaybackRate
            },
            () => {
                const player = this.videoRef.current;
                if (!player) return;

                player.playbackRate = nextPlaybackRate;
            }
        );

        TdLibController.clientUpdate({
            '@type': 'clientUpdateMediaPlaybackRate',
            playbackRate: nextPlaybackRate
        });
    };

    render() {
        const { classes } = this.props;
        const { playing, message, src, currentTime, playbackRate } = this.state;

        const title = getTitle(message);
        const dateHint = getDateHint(message);
        const date = getDate(message);

        console.log(
            'clientUpdateMediaPlaybackRate render playbackRate',
            playbackRate,
            playbackRate === PLAYER_PLAYBACKRATE_NORMAL ? 'default' : 'primary'
        );

        return (
            <>
                <video
                    className='header-player-video'
                    ref={this.videoRef}
                    src={src}
                    autoPlay
                    width={48}
                    height={48}
                    controls={false}
                    onCanPlay={this.handleCanPlay}
                    onPlay={this.handleVideoPlay}
                    onPause={this.handleVideoPause}
                    onTimeUpdate={this.handleTimeUpdate}
                    onEnded={this.handleEnded}
                />
                {message && (
                    <div className={classNames(classes.borderColor, 'header-player')}>
                        {/*<IconButton className={classes.skipPreviousIconButton}>*/}
                        {/*<SkipPreviousIcon />*/}
                        {/*</IconButton>*/}
                        <IconButton
                            className={classes.iconButton}
                            color='primary'
                            disabled={!src}
                            onClick={this.handlePlay}>
                            {playing ? <PauseIcon fontSize='small' /> : <PlayArrowIcon fontSize='small' />}
                        </IconButton>
                        {/*<IconButton className={classes.skipNextIconButton}>*/}
                        {/*<SkipNextIcon />*/}
                        {/*</IconButton>*/}
                        <div className='header-player-content'>
                            <div className='header-player-title'>
                                <span>{title}</span>
                                <span title={dateHint} style={{ paddingLeft: 8 }}>
                                    {date}
                                </span>
                            </div>
                            <div className='header-player-meta'>
                                {getVideoDurationString(Math.floor(currentTime || 0))}
                            </div>
                        </div>
                        <IconButton
                            className={classes.iconButton}
                            color={playbackRate > PLAYER_PLAYBACKRATE_NORMAL ? 'primary' : 'default'}
                            onClick={this.handlePlaybackRate}>
                            <div className='header-player-playback-icon'>2X</div>
                        </IconButton>
                        <IconButton className={classes.iconButton} onClick={this.handleClose}>
                            <CloseIcon fontSize='small' />
                        </IconButton>
                    </div>
                )}
            </>
        );
    }
}

HeaderPlayer.propTypes = {};

const enhance = compose(
    withTranslation(),
    withStyles(styles, { withTheme: true })
);

export default enhance(HeaderPlayer);