import streamlit as st
from streamlit_monaco_copilot import st_monaco_copilot


from uuid import uuid4

value = st_monaco_copilot(
    "foo", 
    language='python',
    initial_code='print("hello world")',
    suggestion=st.session_state.get('suggestion', ''), 
    key='fixed'  # component need a key! or it will not be destoryed by streamlit rerun when suggestion changed!
)


value


if value and value.get('uuid'):
    new_uuid = value['uuid']
else:
    new_uuid = ''

if value and new_uuid and new_uuid != st.session_state.get('uuid'):
    st.session_state['suggestion'] = 'i have suggestion about this code: `' + value.get('beforeCursor', '') + '`'
    st.session_state['uuid'] = new_uuid
    import time 
    time.sleep(1)  # i don't know why, but without this, the fontend component will not work
    st.rerun()