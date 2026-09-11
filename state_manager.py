user_states = {}

STATE_IDLE = 0
STATE_CLIP_MODE = 1

def init_state(sender_jid):
    if sender_jid not in user_states:
        user_states[sender_jid] = {
            "state": STATE_IDLE
        }
    return user_states[sender_jid]

def clear_state(sender_jid):
    if sender_jid in user_states:
        user_states[sender_jid]["state"] = STATE_IDLE
