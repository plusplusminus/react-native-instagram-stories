import React, {
  forwardRef, useEffect, useImperativeHandle, useState,
} from 'react';
import { Modal } from 'react-native';
import Animated, {
  cancelAnimation, interpolate, runOnJS, useAnimatedGestureHandler, useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue, useSharedValue, withTiming,
} from 'react-native-reanimated';
import {
  ANIMATION_CONFIG, HEIGHT, LONG_PRESS_DURATION, WIDTH,
} from '../../core/constants';
import { GestureContext, StoryModalProps, StoryModalPublicMethods } from '../../core/dto/componentsDTO';
import GestureHandler from './gesture';
import StoryList from '../List';
import ModalStyles from './Modal.styles';

const StoryModal = forwardRef<StoryModalPublicMethods, StoryModalProps>( ( {
  stories, seenStories, duration, storyAvatarSize, textStyle, onLoad, onShow, onHide,
}, ref ) => {

  const [ visible, setVisible ] = useState( false );

  const x = useSharedValue( 0 );
  const y = useSharedValue( HEIGHT );
  const animation = useSharedValue( 0 );
  const currentStory = useSharedValue( stories[0].id );

  const userIndex = useDerivedValue( () => Math.round( x.value / WIDTH ) );
  const userId = useDerivedValue( () => stories[userIndex.value]?.id );
  const nextUserId = useDerivedValue( () => stories[userIndex.value + 1]?.id );
  const previousUserId = useDerivedValue( () => stories[userIndex.value - 1]?.id );
  const previousStory = useDerivedValue( () => stories[userIndex.value - 1]?.id );
  const nextStory = useDerivedValue( () => stories[userIndex.value + 1]?.id );

  const animatedStyles = useAnimatedStyle( () => ( { top: y.value } ) );
  const backgroundAnimatedStyles = useAnimatedStyle( () => ( {
    opacity: interpolate( y.value, [ 0, HEIGHT ], [ 1, 0 ] ),
  } ) );

  const onClose = () => {

    'worklet';

    y.value = withTiming(
      HEIGHT,
      ANIMATION_CONFIG,
      () => runOnJS( setVisible )( false ),
    );

  };

  const stopAnimation = ( pause = false ) => {

    'worklet';

    cancelAnimation( animation );

    if ( !pause ) {

      animation.value = 0;

    }

  };

  const startAnimation = ( resume = false ) => {

    'worklet';

    let newDuration = duration;

    if ( resume ) {

      newDuration -= animation.value * duration;

    } else {

      animation.value = 0;
      seenStories.value[userId.value] = currentStory.value;

    }

    animation.value = withTiming( 1, { duration: newDuration } );

  };

  const scrollTo = ( id: string, animated = true ) => {

    'worklet';

    const newUserIndex = stories.findIndex( ( story ) => story.id === id );
    const newX = newUserIndex * WIDTH;

    if ( !newUserIndex || !stories[newUserIndex] || newX === x.value ) {

      return;

    }

    x.value = animated ? withTiming( newX, ANIMATION_CONFIG ) : newX;
    currentStory.value = seenStories.value[id] ?? stories[0].id;

    stopAnimation();
    startAnimation();

  };

  const toNextStory = () => {

    'worklet';

    if ( !nextStory.value ) {

      if ( nextUserId.value ) {

        scrollTo( nextUserId.value );

      } else {

        onClose();

      }

    } else {

      currentStory.value = nextStory.value;

    }

  };

  const toPreviousStory = () => {

    'worklet';

    if ( !previousStory.value ) {

      if ( previousUserId.value ) {

        scrollTo( previousUserId.value );

      }

    } else {

      currentStory.value = previousStory.value;

    }

  };

  const onGestureEvent = useAnimatedGestureHandler( {
    onStart: ( e, ctx: GestureContext ) => {

      ctx.x = x.value;
      ctx.pressedX = e.x;
      ctx.pressedAt = Date.now();
      stopAnimation( true );

    },
    onActive: ( e, ctx ) => {

      if ( ctx.x === x.value
        && ( ctx.vertical || ( Math.abs( e.velocityX ) < Math.abs( e.velocityY ) ) ) ) {

        ctx.vertical = true;
        y.value = Math.max( 0, e.translationY / 2 );

      } else {

        ctx.moving = true;
        x.value = Math.max(
          0,
          Math.min( ctx.x + -e.translationX, WIDTH * ( stories.length - 1 ) ),
        );

      }

    },
    onFinish: ( e, ctx ) => {

      if ( ctx.vertical ) {

        if ( e.translationY > 100 ) {

          onClose();

        } else {

          y.value = withTiming( 0 );
          startAnimation();

        }

      } else if ( ctx.moving ) {

        const diff = x.value - ctx.x;

        scrollTo( diff < 0 ? nextUserId.value : previousUserId.value );

      } else if ( ctx.pressedAt + LONG_PRESS_DURATION < Date.now() ) {

        startAnimation( true );

      } else if ( ctx.pressedX < WIDTH / 2 ) {

        toPreviousStory();

      } else {

        toNextStory();

      }

      ctx.moving = false;
      ctx.vertical = false;

    },
  } );

  useImperativeHandle( ref, () => ( { show: ( id ) => scrollTo( id, false ) } ) );

  useEffect( () => {

    if ( visible ) {

      onShow?.( currentStory.value );
      onLoad?.();

      y.value = withTiming( 0, ANIMATION_CONFIG );

    } else {

      onHide?.( currentStory.value );

    }

  }, [ visible ] );

  useAnimatedReaction(
    () => animation.value,
    ( res, prev ) => {

      if ( res !== prev && res === 1 ) {

        toNextStory();

      }

    },
    [ animation.value ],
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <GestureHandler onGestureEvent={onGestureEvent}>
        <Animated.View style={ModalStyles.container}>
          <Animated.View style={[ ModalStyles.absolute, backgroundAnimatedStyles ]} />
          <Animated.View style={[
            ModalStyles.absoluteContainer, { width: WIDTH, height: HEIGHT }, animatedStyles,
          ]}
          >
            {stories?.map( ( story, index ) => (
              <StoryList
                {...story}
                index={index}
                x={x}
                activeUser={userId}
                activeStory={currentStory}
                progress={animation}
                onClose={onClose}
                onLoad={startAnimation}
                avatarSize={storyAvatarSize}
                textStyle={textStyle}
                key={story.id}
              />
            ) )}
          </Animated.View>
        </Animated.View>
      </GestureHandler>
    </Modal>
  );

} );

export default StoryModal;